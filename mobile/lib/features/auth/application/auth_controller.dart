import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/storage/token_storage.dart';
import '../../../core/utils/jwt_role.dart';
import '../../../shared/models/app_user.dart';
import '../data/auth_repository.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// The mobile app is a citizen-only client; staff keep using the web portal.
const String _staffAccountMessage =
    'This app is for citizens only. Staff accounts (operator, center and admin) '
    'must use the NQS web portal.';

class AuthState {
  const AuthState({required this.status, this.user});

  const AuthState.unknown() : status = AuthStatus.unknown, user = null;
  const AuthState.signedOut()
    : status = AuthStatus.unauthenticated,
      user = null;

  final AuthStatus status;
  final AppUser? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isResolving => status == AuthStatus.unknown;
}

/// Owns the signed-in session while the app is running, keeps the profile fresh,
/// and clears everything when the backend rejects the token.
class AuthController extends Notifier<AuthState> {
  late final AuthRepository _repository = ref.read(authRepositoryProvider);
  late final TokenStorage _tokens = ref.read(tokenStorageProvider);

  @override
  AuthState build() {
    // A 401 anywhere in the app ends the session, since there is no refresh token.
    ref.read(apiClientProvider).setUnauthorizedHandler(_handleUnauthorized);
    // The mobile flow intentionally starts at Login on every launch. The splash
    // screen waits on this state, so keep the startup decision bounded.
    Future.microtask(
      () => restoreSession().timeout(
        const Duration(seconds: 15),
        onTimeout: () {
          if (state.isResolving) state = const AuthState.signedOut();
        },
      ),
    );
    return const AuthState.unknown();
  }

  Future<void> restoreSession() async {
    final token = await _tokens.readToken();
    if (token != null && token.isNotEmpty) await _tokens.clear();
    state = const AuthState.signedOut();
  }

  Future<LoginResult> login({
    required String identifier,
    required String password,
    bool rememberUsername = true,
  }) async {
    final result = await _repository.login(
      identifier: identifier,
      password: password,
    );
    if (result.needsOtp) return result;
    await _persist(result);
    await _tokens.setRememberedUsername(
      rememberUsername ? identifier.trim() : null,
    );
    return result;
  }

  Future<void> completeLoginOtp({
    required String loginToken,
    required String otpId,
    required String code,
  }) async {
    final result = await _repository.verifyLoginOtp(
      loginToken: loginToken,
      otpId: otpId,
      code: code,
    );
    await _persist(result);
  }

  Future<void> register({
    required String username,
    required String password,
    String? phone,
    String? name,
    String? email,
  }) async {
    final result = await _repository.register(
      username: username,
      password: password,
      phone: phone,
      name: name,
      email: email,
    );
    await _persist(result);
  }

  /// Re-reads `/api/auth/profile`; used after profile edits and on pull to refresh.
  Future<void> refreshProfile() async {
    if (!state.isAuthenticated) return;
    try {
      final user = await _repository.profile();
      final merged = _withJwtRole(user, await _tokens.readToken());
      if (!merged.isCitizen) {
        await logout();
        return;
      }
      state = AuthState(status: AuthStatus.authenticated, user: merged);
    } catch (_) {
      // Keep the cached profile; the failure surfaces on the screen that asked.
    }
  }

  void setUser(AppUser user) {
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> logout() async {
    await _repository.logout();
    await _tokens.clear();
    state = const AuthState.signedOut();
  }

  Future<void> _persist(LoginResult result) async {
    final token = result.token;
    final rawUser = result.user;
    if (token == null || token.isEmpty || rawUser == null) return;
    // Role is already normalized in AppUser.fromJson (admin/operator/citizen).
    final user = _withJwtRole(rawUser, token);
    if (!user.isCitizen) {
      await _repository.logout();
      await _tokens.clear();
      state = const AuthState.signedOut();
      throw ApiException(
        message: _staffAccountMessage,
        kind: ApiErrorKind.forbidden,
        statusCode: 403,
      );
    }
    await _tokens.saveSession(token: token, role: user.role);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  /// The profile payload sometimes omits the role, so the JWT claim wins when
  /// the two disagree. This is what the citizen-only gate checks.
  AppUser _withJwtRole(AppUser user, String? token) {
    final jwtRole = roleFromJwt(token);
    if (jwtRole == null || jwtRole == user.role) return user;
    return user.copyWith(role: jwtRole);
  }

  void _handleUnauthorized() {
    if (state.status == AuthStatus.unauthenticated) return;
    _tokens.clear();
    state = const AuthState.signedOut();
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

/// Convenience selector for widgets that only need the profile.
final currentUserProvider = Provider<AppUser?>(
  (ref) => ref.watch(authControllerProvider).user,
);
