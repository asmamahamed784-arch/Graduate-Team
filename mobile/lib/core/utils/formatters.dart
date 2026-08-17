import 'dart:convert';
import 'dart:typed_data';

import 'package:intl/intl.dart';

class Formatters {
  const Formatters._();

  static final DateFormat _apiDate = DateFormat('yyyy-MM-dd');
  static final DateFormat _usDate = DateFormat('MM/dd/yyyy');
  static final DateFormat _readableDate = DateFormat('EEE, d MMM yyyy');
  static final DateFormat _shortDate = DateFormat('d MMM yyyy');
  static final DateFormat _dateTime = DateFormat('d MMM yyyy • h:mm a');

  /// The backend stores `Ticket.date` as a plain `yyyy-MM-dd` string.
  static String apiDate(DateTime date) => _apiDate.format(date);

  /// Display format used by the Date of Birth field (image-3 style).
  static String usDate(DateTime date) => _usDate.format(date);

  static DateTime? parseApiDate(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final text = value.trim();
    final api = DateTime.tryParse(text);
    if (api != null) return DateTime(api.year, api.month, api.day);
    try {
      final us = _usDate.parseStrict(text);
      return DateTime(us.year, us.month, us.day);
    } catch (_) {
      return null;
    }
  }

  static String readableDate(String? value) {
    final parsed = parseApiDate(value);
    return parsed == null ? (value ?? '--') : _readableDate.format(parsed);
  }

  static String shortDate(DateTime? date) =>
      date == null ? '--' : _shortDate.format(date);

  static String dateTime(DateTime? date) => date == null ? '--' : _dateTime.format(date);

  static String relative(DateTime? date) {
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return _shortDate.format(date);
  }

  static String phoneDisplay(String? phone) {
    final digits = (phone ?? '').replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return '--';
    final local = digits.startsWith('252') ? digits.substring(3) : digits;
    if (local.length == 9) {
      return '+252 ${local.substring(0, 2)} ${local.substring(2, 5)} ${local.substring(5)}';
    }
    return '+252 $local';
  }

  /// Masks all but the last two digits, used on OTP screens.
  static String maskedPhone(String? phone) {
    final digits = (phone ?? '').replaceAll(RegExp(r'\D'), '');
    if (digits.length < 4) return phone ?? '';
    final visible = digits.substring(digits.length - 2);
    return '${'*' * (digits.length - 2)}$visible';
  }

  /// `GET /api/qr/generate` answers with a `data:image/png;base64,...` string.
  static Uint8List? decodeDataUrl(String? dataUrl) {
    if (dataUrl == null || dataUrl.isEmpty) return null;
    final commaIndex = dataUrl.indexOf(',');
    final payload = commaIndex == -1 ? dataUrl : dataUrl.substring(commaIndex + 1);
    try {
      return base64Decode(payload);
    } catch (_) {
      return null;
    }
  }

  static String initials(String? name) {
    final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return 'NQ';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  static String titleCase(String? value) {
    final trimmed = (value ?? '').trim().replaceAll('_', ' ');
    if (trimmed.isEmpty) return '';
    return trimmed
        .split(RegExp(r'\s+'))
        .map((word) => word[0].toUpperCase() + word.substring(1).toLowerCase())
        .join(' ');
  }
}
