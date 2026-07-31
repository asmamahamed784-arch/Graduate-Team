import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT issued by `POST /api/auth/login` in the platform keystore.
/// The backend issues a 30 day access token and has no refresh endpoint, so a
/// rejected token means the user must sign in again.
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  static const String _tokenKey = 'nqs_jwt_token';
  static const String _roleKey = 'nqs_role';
  static const String _usernameKey = 'nqs_remembered_username';

  final FlutterSecureStorage _storage;

  String? _cachedToken;

  Future<String?> readToken() async {
    _cachedToken ??= await _storage.read(key: _tokenKey);
    return _cachedToken;
  }

  /// Synchronous access for the Dio interceptor, warmed by [readToken].
  String? get cachedToken => _cachedToken;

  Future<void> saveSession({required String token, String? role}) async {
    _cachedToken = token;
    await _storage.write(key: _tokenKey, value: token);
    if (role != null) {
      await _storage.write(key: _roleKey, value: role);
    }
  }

  Future<String?> readRole() => _storage.read(key: _roleKey);

  Future<void> clear() async {
    _cachedToken = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _roleKey);
  }

  Future<String?> readRememberedUsername() => _storage.read(key: _usernameKey);

  Future<void> setRememberedUsername(String? username) async {
    if (username == null || username.isEmpty) {
      await _storage.delete(key: _usernameKey);
      return;
    }
    await _storage.write(key: _usernameKey, value: username);
  }
}
