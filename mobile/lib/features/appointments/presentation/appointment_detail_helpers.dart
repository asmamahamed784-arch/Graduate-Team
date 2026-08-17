import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/appointment.dart';
import '../application/appointments_controller.dart';
import '../data/booking_repository.dart';

final appointmentDetailProvider = FutureProvider.family<Appointment, String>(
  isAutoDispose: true,
  (ref, id) async {
    final cached = ref.watch(appointmentByIdProvider(id));
    if (cached != null) return cached;
    return ref.watch(bookingRepositoryProvider).byReference(id);
  },
);

/// Human labels + lookup helpers for citizen submitted fields.
class AppointmentFieldInfo {
  const AppointmentFieldInfo({
    required this.key,
    required this.label,
    required this.value,
    this.icon,
  });

  final String key;
  final String label;
  final String value;
  final String? icon;

  static String labelOf(String key) {
    const map = {
      'fullName': 'Full name',
      'motherName': "Mother's name",
      'dateOfBirth': 'Date of birth',
      'age': 'Age',
      'gender': 'Gender',
      'maritalStatus': 'Marital status',
      'phone': 'Phone',
      'address': 'Address',
      'fullAddress': 'Full address',
      'district': 'District',
      'centerDistrict': 'Center district',
      'selectedCenter': 'Selected center',
      'nearestLandmark': 'Nearest landmark',
      'nationalIdNumber': 'National ID',
      'nationalId': 'National ID',
    };
    if (map.containsKey(key)) return map[key]!;
    return key
        .replaceAllMapped(RegExp(r'([A-Z])'), (m) => ' ${m.group(0)}')
        .replaceAll('_', ' ')
        .trim();
  }

  /// Match staff incorrect-field labels to detail keys.
  static String? keyForReason(String reason, Map<String, dynamic> details) {
    final r = reason.trim().toLowerCase();
    final aliases = <String, List<String>>{
      'mother': ['motherName', 'mother_name'],
      'age': ['age'],
      'marital': ['maritalStatus', 'marital_status'],
      'full name': ['fullName', 'full_name'],
      'phone': ['phone'],
      'gender': ['gender'],
      'address': ['address', 'fullAddress'],
      'district': ['district', 'centerDistrict'],
      'date of birth': ['dateOfBirth', 'date_of_birth'],
      'landmark': ['nearestLandmark'],
    };

    for (final entry in aliases.entries) {
      if (r.contains(entry.key)) {
        for (final k in entry.value) {
          if (details.containsKey(k)) return k;
        }
        return entry.value.first;
      }
    }

    for (final key in details.keys) {
      if (labelOf(key).toLowerCase() == r || key.toLowerCase() == r) {
        return key;
      }
    }
    return null;
  }

  static List<AppointmentFieldInfo> fromDetails(Map<String, dynamic> details) {
    final hidden = {
      'cancellationdetails',
      'cancellationreason',
      'cancellationreasons',
      'cancellationnotes',
      'cancelledat',
      'cancelledby',
      'previousstatusbeforecancellation',
      'additionalcancellationreason',
      'snapshot',
      'appointment',
      'requesttype',
      'summary',
      'changes',
    };

    final list = <AppointmentFieldInfo>[];
    details.forEach((key, value) {
      if (value == null) return;
      if (hidden.contains(key.toLowerCase())) return;
      if (value is Map) return;
      if (value is String && value.trim().isEmpty) return;
      if (value is List && value.isEmpty) return;
      final text = value is List ? value.map((e) => '$e').join(', ') : '$value';
      list.add(
        AppointmentFieldInfo(
          key: key,
          label: labelOf(key),
          value: text,
        ),
      );
    });
    return list;
  }
}
