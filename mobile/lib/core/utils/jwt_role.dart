import 'dart:convert';

import 'role_utils.dart';

/// Reads `role` from a JWT payload without verifying the signature.
/// Used only as a routing fallback when the user object is incomplete.
String? roleFromJwt(String? token) {
  if (token == null || token.isEmpty) return null;
  final parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    final normalized = base64Url.normalize(parts[1]);
    final json = jsonDecode(utf8.decode(base64Url.decode(normalized)));
    if (json is! Map) return null;
    final role = json['role']?.toString();
    if (role == null || role.trim().isEmpty) return null;
    return normalizeRole(role);
  } catch (_) {
    return null;
  }
}
