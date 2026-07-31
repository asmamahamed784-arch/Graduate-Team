/// Helpers for the backend's loosely typed JSON.
///
/// Relation fields such as `Ticket.service` come back either as a bare id
/// string (raw Prisma row) or as a nested object (hydrated response), so every
/// model reads them through [refId] / [refName].
class Json {
  const Json._();

  static String str(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    if (value is String) return value;
    return value.toString();
  }

  static String? strOrNull(dynamic value) {
    if (value == null) return null;
    final text = value is String ? value : value.toString();
    return text.trim().isEmpty ? null : text;
  }

  static int intOf(dynamic value, [int fallback = 0]) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  static bool boolOf(dynamic value, {bool fallback = false}) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final lower = value.toLowerCase();
      return lower == 'true' || lower == '1' || lower == 'yes';
    }
    return fallback;
  }

  static DateTime? date(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    return DateTime.tryParse(value.toString())?.toLocal();
  }

  static Map<String, dynamic> map(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return const {};
  }

  static Map<String, dynamic>? mapOrNull(dynamic value) {
    if (value is Map && value.isNotEmpty) return Map<String, dynamic>.from(value);
    return null;
  }

  static List<Map<String, dynamic>> mapList(dynamic value) {
    if (value is List) {
      return value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return const [];
  }

  static List<String> stringList(dynamic value) {
    if (value is List) {
      return value.map((e) => e?.toString() ?? '').where((e) => e.isNotEmpty).toList();
    }
    return const [];
  }

  /// Id of a relation that may be a string, or an object with `id` / `_id`.
  static String refId(dynamic value) {
    if (value == null) return '';
    if (value is String) return value;
    if (value is Map) return str(value['id'] ?? value['_id']);
    return '';
  }

  /// Display name of a relation, falling back to an empty string when the
  /// backend only sent the id.
  static String refName(dynamic value, [String fallback = '']) {
    if (value is Map) {
      final name = strOrNull(value['name']) ?? strOrNull(value['fullName']);
      if (name != null) return name;
    }
    return fallback;
  }

  /// Prefers the Mongo-style `_id` the backend adds for web compatibility,
  /// falling back to the Prisma `id`.
  static String idOf(Map<String, dynamic> json) =>
      strOrNull(json['id']) ?? strOrNull(json['_id']) ?? '';
}
