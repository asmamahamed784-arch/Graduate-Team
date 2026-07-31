import 'package:dio/dio.dart';

enum ApiErrorKind {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  rateLimited,
  server,
  cancelled,
  unknown,
}

/// A single error type the UI can render, built from the backend's
/// `{ success: false, message }` envelope or from a transport failure.
class ApiException implements Exception {
  ApiException({
    required this.message,
    required this.kind,
    this.statusCode,
    this.data,
  });

  final String message;
  final ApiErrorKind kind;
  final int? statusCode;

  /// The `data` object some endpoints attach to errors (e.g. the existing
  /// ticket on a 409 duplicate booking, or `retryAfter` on OTP throttling).
  final Map<String, dynamic>? data;

  bool get isUnauthorized => kind == ApiErrorKind.unauthorized;
  bool get isOffline => kind == ApiErrorKind.network || kind == ApiErrorKind.timeout;

  /// Seconds the caller must wait before retrying an OTP request.
  int? get retryAfter {
    final value = data?['retryAfter'];
    if (value is num) return value.toInt();
    return null;
  }

  factory ApiException.fromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          message: 'The server took too long to respond. Please try again.',
          kind: ApiErrorKind.timeout,
        );
      case DioExceptionType.cancel:
        return ApiException(message: 'Request cancelled.', kind: ApiErrorKind.cancelled);
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        if (error.response == null) {
          return ApiException(
            message:
                'Cannot reach the NQS server. Check your connection and that the backend is running.',
            kind: ApiErrorKind.network,
          );
        }
        break;
      case DioExceptionType.badCertificate:
        return ApiException(
          message: 'The server certificate could not be verified.',
          kind: ApiErrorKind.network,
        );
      case DioExceptionType.badResponse:
        break;
      default:
        if (error.response == null) {
          return ApiException(
            message: 'The request could not be completed. Please try again.',
            kind: ApiErrorKind.unknown,
          );
        }
    }

    final response = error.response;
    final status = response?.statusCode;
    final body = response?.data;

    String? message;
    Map<String, dynamic>? payload;
    if (body is Map) {
      final map = Map<String, dynamic>.from(body);
      final raw = map['message'];
      if (raw is String && raw.trim().isNotEmpty) message = raw.trim();
      final data = map['data'];
      if (data is Map) payload = Map<String, dynamic>.from(data);
      payload = {...?payload, ...map}..remove('data');
    }

    return ApiException(
      message: message ?? _defaultMessage(status),
      kind: _kindFor(status),
      statusCode: status,
      data: payload,
    );
  }

  static ApiErrorKind _kindFor(int? status) {
    switch (status) {
      case 400:
        return ApiErrorKind.validation;
      case 401:
        return ApiErrorKind.unauthorized;
      case 403:
        return ApiErrorKind.forbidden;
      case 404:
        return ApiErrorKind.notFound;
      case 409:
        return ApiErrorKind.conflict;
      case 429:
        return ApiErrorKind.rateLimited;
      default:
        if (status != null && status >= 500) return ApiErrorKind.server;
        return ApiErrorKind.unknown;
    }
  }

  static String _defaultMessage(int? status) {
    switch (status) {
      case 400:
        return 'Some of the information you entered is not valid.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'We could not find what you were looking for.';
      case 409:
        return 'This request conflicts with an existing one.';
      case 429:
        return 'Too many attempts. Please wait a moment and try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  @override
  String toString() => message;
}
