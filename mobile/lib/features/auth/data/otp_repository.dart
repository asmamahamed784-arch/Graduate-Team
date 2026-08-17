import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/utils/json_utils.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/models/otp_session.dart';

/// Wraps the OTP endpoints used by the booking flow and the password reset.
///
/// Both flows follow the same shape: request a code, verify it, then use the
/// returned short-lived `verificationToken` on the real action.
class OtpRepository {
  const OtpRepository(this._api);

  final ApiClient _api;

  /// `POST /api/otp/request` — requires an authenticated citizen.
  Future<OtpSession> request({
    required String purpose,
    String? phone,
    String? ticketId,
    bool resend = false,
  }) async {
    final data = await _api.post(
      ApiEndpoints.otpRequest,
      body: {
        'purpose': purpose,
        'resend': resend,
        if (phone != null && phone.trim().isNotEmpty)
          'phone': Validators.normalizePhone(phone),
        if (ticketId != null) 'ticketId': ticketId,
      },
    );
    return OtpSession.fromJson(data, fallbackPurpose: purpose);
  }

  /// Returns the `verificationToken` to send as `otpToken` on `POST /api/bookings`.
  Future<String> verify({
    required String purpose,
    required String code,
    String? otpId,
    String? phone,
    String? ticketId,
  }) async {
    final normalizedPhone = Validators.normalizePhone(phone);
    final data = await _api.post(
      ApiEndpoints.otpVerify,
      body: {
        'purpose': purpose,
        'code': code.trim(),
        if (otpId != null && otpId.isNotEmpty) 'otpId': otpId,
        if (normalizedPhone.isNotEmpty) 'phone': normalizedPhone,
        if (ticketId != null) 'ticketId': ticketId,
      },
    );
    return Json.str(data['verificationToken']);
  }

  /// `POST /api/otp/forgot-password/request` — public, identified by username
  /// or phone number.
  Future<OtpSession> requestPasswordReset({
    required String identifier,
    bool resend = false,
    String? phone,
  }) async {
    final data = await _api.post(
      ApiEndpoints.forgotPasswordRequest,
      body: {
        'identifier': identifier.trim(),
        'resend': resend,
        if (phone != null && phone.isNotEmpty) 'phone': Validators.normalizePhone(phone),
      },
      skipAuth: true,
    );
    return OtpSession.fromJson(data, fallbackPurpose: 'forgot_password');
  }

  Future<String> verifyPasswordReset({
    required String identifier,
    required String code,
    String? otpId,
    String? phone,
    String? userId,
  }) async {
    final data = await _api.post(
      ApiEndpoints.forgotPasswordVerify,
      body: {
        'identifier': identifier.trim(),
        'code': code.trim(),
        if (otpId != null && otpId.isNotEmpty) 'otpId': otpId,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (userId != null && userId.isNotEmpty) 'userId': userId,
      },
      skipAuth: true,
    );
    return Json.str(data['verificationToken']);
  }

  Future<String> resetPassword({
    required String password,
    required String verificationToken,
    String? phone,
    String? userId,
  }) async {
    return _api.postForMessage(
      ApiEndpoints.forgotPasswordReset,
      body: {
        'password': password,
        'verificationToken': verificationToken,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (userId != null && userId.isNotEmpty) 'userId': userId,
      },
      skipAuth: true,
    );
  }
}

final otpRepositoryProvider =
    Provider<OtpRepository>((ref) => OtpRepository(ref.watch(apiClientProvider)));
