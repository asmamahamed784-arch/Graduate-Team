import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT issued by `POST /api/auth/login` in the platform keystore.
/// The backend issues a 30 day access token and has no refresh endpoint, so a
/// rejected token means the user must sign in again.
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              // Some Samsung/Knox devices invalidate the Keystore key behind this
              // plugin (after a lock-screen or biometric change) and every read/write
              // then throws KeyPermanentlyInvalidatedException forever, which made a
              // real earlier login look "forgotten" on next launch. resetOnError wipes
              // just that corrupted entry and lets the plugin recover instead of
              // failing permanently — the cost is that one specific session, not every
              // future one.
              aOptions: AndroidOptions(resetOnError: true),
            );

  static const String _tokenKey = 'nqs_jwt_token';
  static const String _roleKey = 'nqs_role';
  static const String _usernameKey = 'nqs_remembered_username';
  static const _guardTimeout = Duration(seconds: 5);

  final FlutterSecureStorage _storage;

  String? _cachedToken;

  /// The Android Keystore backing this plugin can hang indefinitely on some
  /// Samsung/Knox devices (seen after a key/cipher mismatch) instead of
  /// throwing — e.g. a hung write during sign-up/sign-in leaves a submit
  /// button spinning forever, and a hung read on launch freezes the splash
  /// screen. Every operation here is time-boxed so a broken keystore only
  /// costs the user a re-login, never a frozen screen.
  static Future<T> _guarded<T>(Future<T> Function() operation, T fallback) async {
    try {
      return await operation().timeout(_guardTimeout);
    } catch (_) {
      return fallback;
    }
  }

  Future<String?> readToken() async {
    if (_cachedToken != null) return _cachedToken;
    _cachedToken = await _guarded(() => _storage.read(key: _tokenKey), null);
    return _cachedToken;
  }

  /// Synchronous access for the Dio interceptor, warmed by [readToken].
  String? get cachedToken => _cachedToken;

  Future<void> saveSession({required String token, String? role}) async {
    _cachedToken = token;
    await _guarded(() => _storage.write(key: _tokenKey, value: token), null);
    if (role != null) {
      await _guarded(() => _storage.write(key: _roleKey, value: role), null);
    }
  }

  Future<String?> readRole() => _guarded(() => _storage.read(key: _roleKey), null);

  Future<void> clear() async {
    _cachedToken = null;
    await _guarded(() => _storage.delete(key: _tokenKey), null);
    await _guarded(() => _storage.delete(key: _roleKey), null);
  }

  Future<String?> readRememberedUsername() =>
      _guarded(() => _storage.read(key: _usernameKey), null);

  Future<void> setRememberedUsername(String? username) async {
    if (username == null || username.isEmpty) {
      await _guarded(() => _storage.delete(key: _usernameKey), null);
      return;
    }
    await _guarded(() => _storage.write(key: _usernameKey, value: username), null);
  }
}
