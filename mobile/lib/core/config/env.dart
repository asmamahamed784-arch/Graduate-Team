import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Reads configuration from the bundled `.env` asset, with `--dart-define`
/// taking precedence so CI/release builds can override without editing files.
class Env {
  const Env._();

  static const String _defineBaseUrl = String.fromEnvironment('API_BASE_URL');

  static Future<void> load() async {
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {
      // Missing .env is not fatal: the defaults below keep the app usable.
      dotenv.loadFromString(envString: '');
    }
  }

  static String _read(String key, String fallback) {
    final value = dotenv.maybeGet(key);
    if (value == null || value.trim().isEmpty) return fallback;
    return value.trim();
  }

  static bool _readBool(String key, {required bool fallback}) {
    final value = _read(key, fallback.toString()).toLowerCase();
    return value == 'true' || value == '1' || value == 'yes';
  }

  /// Backend origin without a trailing slash, e.g. `http://10.0.2.2:5005`.
  static String get apiBaseUrl {
    final raw = _defineBaseUrl.isNotEmpty
        ? _defineBaseUrl
        : _read('API_BASE_URL', 'http://localhost:5005');
    return _resolveHost(raw).replaceAll(RegExp(r'/+$'), '');
  }

  static bool get enableRealtime => _readBool('ENABLE_REALTIME', fallback: true);

  static bool get enableHttpLogs =>
      kDebugMode && _readBool('ENABLE_HTTP_LOGS', fallback: true);

  /// An Android emulator cannot reach the host machine through `localhost`;
  /// `10.0.2.2` is the alias the emulator maps to the host loopback.
  static String _resolveHost(String url) {
    if (kIsWeb || !Platform.isAndroid) return url;
    return url
        .replaceFirst('//localhost', '//10.0.2.2')
        .replaceFirst('//127.0.0.1', '//10.0.2.2');
  }
}
