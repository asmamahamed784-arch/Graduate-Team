import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/env.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

/// Centralised HTTP client for the existing NQS REST API.
///
/// Every backend response follows `{ success, data, message?, count? }`, so the
/// helpers here unwrap `data` and surface `message` as an [ApiException].
class ApiClient {
  ApiClient({required TokenStorage tokenStorage, Dio? dio})
      : _tokenStorage = tokenStorage,
        _dio = dio ?? Dio() {
    _dio.options = _dio.options.copyWith(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      // Envelope errors are handled explicitly instead of by status code alone.
      validateStatus: (status) => status != null && status < 400,
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['skipAuth'] != true) {
            final token = _tokenStorage.cachedToken ?? await _tokenStorage.readToken();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
        onError: (error, handler) {
          final isAuthCall = error.requestOptions.extra['skipAuth'] == true;
          final path = error.requestOptions.path;
          // Wrong current-password on change-password is not a session expiry.
          final isPasswordChange = path.contains('/api/auth/password');
          if (error.response?.statusCode == 401 && !isAuthCall && !isPasswordChange) {
            // The backend has no refresh flow: an invalid token ends the session.
            _onUnauthorized?.call();
          }
          handler.next(error);
        },
      ),
    );

    if (Env.enableHttpLogs) {
      _dio.interceptors.add(
        LogInterceptor(
          request: false,
          requestHeader: false,
          requestBody: true,
          responseHeader: false,
          responseBody: true,
          logPrint: (object) => debugPrint('[NQS API] $object'),
        ),
      );
    }
  }

  final Dio _dio;
  final TokenStorage _tokenStorage;
  VoidCallback? _onUnauthorized;

  String get baseUrl => _dio.options.baseUrl;

  /// Registered by the session controller to sign the user out on a 401.
  void setUnauthorizedHandler(VoidCallback handler) => _onUnauthorized = handler;

  Future<Response<dynamic>> _send(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) async {
    try {
      return await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method, extra: {'skipAuth': skipAuth}),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<dynamic> getRaw(
    String path, {
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) async {
    final response = await _send('GET', path, query: query, skipAuth: skipAuth);
    return _unwrap(response);
  }

  /// GET returning the `data` object.
  Future<Map<String, dynamic>> getObject(
    String path, {
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) async =>
      _asMap(await getRaw(path, query: query, skipAuth: skipAuth));

  /// GET returning the `data` array.
  Future<List<Map<String, dynamic>>> getList(
    String path, {
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) async =>
      _asList(await getRaw(path, query: query, skipAuth: skipAuth));

  Future<Map<String, dynamic>> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) async {
    final response = await _send('POST', path, body: body, query: query, skipAuth: skipAuth);
    return _asMap(_unwrap(response));
  }

  /// Full success envelope (`data`, `message`, `temporaryPassword`, …).
  Future<Map<String, dynamic>> postFull(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) async {
    final response = await _send(
      'POST',
      path,
      body: body,
      query: query,
      skipAuth: skipAuth,
    );
    final raw = response.data;
    _assertSuccess(raw, response.statusCode);
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {'data': raw};
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Object? body,
    bool skipAuth = false,
  }) async {
    final response = await _send('PUT', path, body: body, skipAuth: skipAuth);
    return _asMap(_unwrap(response));
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await _send('DELETE', path);
    return _asMap(_unwrap(response));
  }

  /// Some endpoints answer with only `{ success, message }`; those callers use
  /// this to keep the message without demanding a `data` payload.
  Future<String> postForMessage(
    String path, {
    Object? body,
    bool skipAuth = false,
  }) async {
    final response = await _send('POST', path, body: body, skipAuth: skipAuth);
    final raw = response.data;
    _assertSuccess(raw, response.statusCode);
    if (raw is Map && raw['message'] is String) return raw['message'] as String;
    return 'Done.';
  }

  /// Returns the `data` value of the envelope, throwing when `success` is false.
  dynamic _unwrap(Response<dynamic> response) {
    final raw = response.data;
    _assertSuccess(raw, response.statusCode);
    if (raw is Map && raw.containsKey('data')) return raw['data'];
    return raw;
  }

  void _assertSuccess(dynamic raw, int? statusCode) {
    if (raw is Map && raw['success'] == false) {
      throw ApiException(
        message: raw['message'] as String? ?? 'The request could not be completed.',
        kind: ApiErrorKind.unknown,
        statusCode: statusCode,
        data: raw['data'] is Map ? Map<String, dynamic>.from(raw['data'] as Map) : null,
      );
    }
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  List<Map<String, dynamic>> _asList(dynamic value) {
    if (value is List) {
      return value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return const [];
  }
}
