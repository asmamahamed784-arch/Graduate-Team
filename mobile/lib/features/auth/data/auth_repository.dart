import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/utils/json_utils.dart';
import '../../../core/utils/jwt_role.dart';
import '../../../core/utils/role_utils.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/models/app_user.dart';
import '../../../shared/models/otp_session.dart';

/// Outcome of `POST /api/auth/login`, which either signs the user in or asks
/// for an SMS code first (`otpRequired: true`).
class LoginResult {
  const LoginResult.session(this.token, this.user) : otpSession = null;
  const LoginResult.otpRequired(this.otpSession)
      : token = null,
        user = null;

  final String? token;
  final AppUser? user;
  final OtpSession? otpSession;

  bool get needsOtp => otpSession != null;
}

class AuthRepository {
  const AuthRepository(this._api);

  final ApiClient _api;

  Future<LoginResult> login({
    required String identifier,
    required String password,
  }) async {
    final data = await _api.post(
      ApiEndpoints.login,
      // `username` also accepts a phone number on the backend.
      body: {'username': identifier.trim(), 'password': password},
      skipAuth: true,
    );

    if (Json.boolOf(data['otpRequired'])) {
      return LoginResult.otpRequired(
        OtpSession.fromJson(data, fallbackPurpose: 'login'),
      );
    }
    final token = Json.str(data['token']);
    return LoginResult.session(token, _userFromAuthPayload(data, token));
  }

  Future<LoginResult> verifyLoginOtp({
    required String loginToken,
    required String otpId,
    required String code,
  }) async {
    final data = await _api.post(
      ApiEndpoints.loginOtpVerify,
      body: {'loginToken': loginToken, 'otpId': otpId, 'code': code},
      skipAuth: true,
    );
    final token = Json.str(data['token']);
    return LoginResult.session(token, _userFromAuthPayload(data, token));
  }

  /// Prefer explicit user.role; fall back to JWT role so admin never lands on citizen UI.
  AppUser _userFromAuthPayload(Map<String, dynamic> data, String token) {
    final userJson = Json.map(data['user']);
    final fromBody = normalizeRole(Json.str(userJson['role']));
    final fromJwt = roleFromJwt(token);
    final role = roleIsAdmin(fromBody) || roleIsOperator(fromBody)
        ? fromBody
        : (fromJwt ?? fromBody);
    return AppUser.fromJson({...userJson, 'role': role});
  }

  Future<OtpSession> resendLoginOtp(String loginToken) async {
    final data = await _api.post(
      ApiEndpoints.loginOtpResend,
      body: {'loginToken': loginToken},
      skipAuth: true,
    );
    return OtpSession.fromJson(data, fallbackPurpose: 'login')
        .copyWith(loginToken: loginToken);
  }

  /// Registration always creates a `citizen`; the phone number is optional on
  /// the backend but required in practice for the OTP-gated booking flow.
  Future<LoginResult> register({
    required String username,
    required String password,
    String? phone,
    String? name,
    String? email,
  }) async {
    final normalizedPhone = Validators.normalizePhone(phone);
    final data = await _api.post(
      ApiEndpoints.register,
      body: {
        'username': username.trim(),
        'password': password,
        if (normalizedPhone.isNotEmpty) 'phone': normalizedPhone,
        if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      },
      skipAuth: true,
    );
    return LoginResult.session(
      Json.str(data['token']),
      AppUser.fromJson(Json.map(data['user'])),
    );
  }

  Future<AppUser> profile() async =>
      AppUser.fromJson(await _api.getObject(ApiEndpoints.profile));

  Future<AppUser> updateProfile({
    String? name,
    String? email,
    String? phone,
    String? nationalId,
    String? dateOfBirth,
    String? address,
  }) async {
    final data = await _api.put(
      ApiEndpoints.profile,
      body: {
        if (name != null) 'name': name.trim(),
        if (email != null) 'email': email.trim(),
        if (phone != null) 'phone': Validators.normalizePhone(phone),
        if (nationalId != null) 'nationalId': nationalId.trim(),
        if (dateOfBirth != null) 'dateOfBirth': dateOfBirth.trim(),
        if (address != null) 'address': address.trim(),
      },
    );
    return AppUser.fromJson(data);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _api.put(
      ApiEndpoints.changePassword,
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  }

  /// Best effort: the local session is cleared even if the call fails.
  Future<void> logout() async {
    try {
      await _api.post(ApiEndpoints.logout, body: const {});
    } catch (_) {}
  }
}

final authRepositoryProvider =
    Provider<AuthRepository>((ref) => AuthRepository(ref.watch(apiClientProvider)));
