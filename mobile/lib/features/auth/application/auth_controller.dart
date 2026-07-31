import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/storage/token_storage.dart';
import '../../../core/utils/jwt_role.dart';
import '../../../shared/models/app_user.dart';
import '../data/auth_repository.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({required this.status, this.user});

  const AuthState.unknown() : status = AuthStatus.unknown, user = null;
  const AuthState.signedOut() : status = AuthStatus.unauthenticated, user = null;

  final AuthStatus status;
  final AppUser? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isResolving => status == AuthStatus.unknown;
}

/// Owns the signed-in session: restores it on launch, keeps the profile fresh,
/// and clears everything when the backend rejects the token.
class AuthController extends Notifier<AuthState> {
  late final AuthRepository _repository = ref.read(authRepositoryProvider);
  late final TokenStorage _tokens = ref.read(tokenStorageProvider);

  @override
  AuthState build() {
    // A 401 anywhere in the app ends the session, since there is no refresh token.
    ref.read(apiClientProvider).setUnauthorizedHandler(_handleUnauthorized);
    Future.microtask(restoreSession);
    return const AuthState.unknown();
  }

  Future<void> restoreSession() async {
    final token = await _tokens.readToken();
    if (token == null || token.isEmpty) {
      state = const AuthState.signedOut();
      return;
    }
    try {
      final user = await _repository.profile().timeout(const Duration(seconds: 12));
      final jwtRole = roleFromJwt(token);
      final merged = (user.isAdmin || user.isOperator || jwtRole == null)
          ? user
          : user.copyWith(role: jwtRole);
      await _tokens.saveSession(token: token, role: merged.role);
      state = AuthState(status: AuthStatus.authenticated, user: merged);
    } catch (_) {
      // Expired token or offline backend: open login instead of hanging on splash.
      await _tokens.clear();
      state = const AuthState.signedOut();
    }
  }

  Future<LoginResult> login({
    required String identifier,
    required String password,
    bool rememberUsername = true,
  }) async {
    final result = await _repository.login(identifier: identifier, password: password);
    if (result.needsOtp) return result;
    await _persist(result);
    await _tokens.setRememberedUsername(rememberUsername ? identifier.trim() : null);
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
  }) async {
    final result = await _repository.register(
      username: username,
      password: password,
      phone: phone,
    );
    await _persist(result);
  }

  /// Re-reads `/api/auth/profile`; used after profile edits and on pull to refresh.
  Future<void> refreshProfile() async {
    if (!state.isAuthenticated) return;
    try {
      final user = await _repository.profile();
      final token = await _tokens.readToken();
      final jwtRole = roleFromJwt(token);
      final merged = (user.isAdmin || user.isOperator || jwtRole == null)
          ? user
          : user.copyWith(role: jwtRole);
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
    final user = result.user;
    if (token == null || token.isEmpty || user == null) return;
    // Role is already normalized in AppUser.fromJson (admin/operator/citizen).
    await _tokens.saveSession(token: token, role: user.role);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  void _handleUnauthorized() {
    if (state.status == AuthStatus.unauthenticated) return;
    _tokens.clear();
    state = const AuthState.signedOut();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Convenience selector for widgets that only need the profile.
final currentUserProvider = Provider<AppUser?>(
  (ref) => ref.watch(authControllerProvider).user,
);
