import '../../core/utils/json_utils.dart';

/// `GET /api/centers` item, produced by `serializeCenter` on the backend.
class CenterModel {
  const CenterModel({
    required this.id,
    required this.name,
    this.address = '',
    this.city = '',
    this.district = '',
    this.phone = '',
    this.counters = 0,
    this.capacity = 0,
    this.hours = '',
    this.status = 'Active',
    this.schedule = const CenterSchedule(),
  });

  final String id;
  final String name;
  final String address;
  final String city;
  final String district;
  final String phone;
  final int counters;
  final int capacity;
  final String hours;
  final String status;
  final CenterSchedule schedule;

  bool get isActive => status.toLowerCase() == 'active' && schedule.isActive;

  String get location {
    final parts = [address, city, district].where((p) => p.trim().isNotEmpty).toSet();
    return parts.isEmpty ? 'Location not provided' : parts.join(', ');
  }

  factory CenterModel.fromJson(Map<String, dynamic> json) => CenterModel(
        id: Json.idOf(json),
        name: Json.str(json['name']),
        address: Json.str(json['address']),
        city: Json.str(json['city']),
        district: Json.str(json['district']),
        phone: Json.str(json['phone']),
        counters: Json.intOf(json['counters']),
        capacity: Json.intOf(json['capacity']),
        hours: Json.str(json['hours']),
        status: Json.str(json['status'], 'Active'),
        schedule: CenterSchedule.fromJson(Json.map(json['schedule'])),
      );
}

class CenterSchedule {
  const CenterSchedule({
    this.workingDays = const ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    this.startTime = '08:00',
    this.endTime = '16:00',
    this.slotDuration = 30,
    this.maxBookingsPerSlot = 5,
    this.maxAppointmentsPerDay = 100,
    this.closedDays = const ['Friday', 'Saturday'],
    this.closedDates = const [],
    this.isActive = true,
  });

  final List<String> workingDays;
  final String startTime;
  final String endTime;
  final int slotDuration;
  final int maxBookingsPerSlot;
  final int maxAppointmentsPerDay;
  final List<String> closedDays;
  final List<String> closedDates;
  final bool isActive;

  factory CenterSchedule.fromJson(Map<String, dynamic> json) {
    if (json.isEmpty) return const CenterSchedule();
    return CenterSchedule(
      workingDays: Json.stringList(json['workingDays']).isEmpty
          ? const ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
          : Json.stringList(json['workingDays']),
      startTime: Json.str(json['startTime'], '08:00'),
      endTime: Json.str(json['endTime'], '16:00'),
      slotDuration: Json.intOf(json['slotDuration'], 30),
      maxBookingsPerSlot: Json.intOf(json['maxBookingsPerSlot'], 5),
      maxAppointmentsPerDay: Json.intOf(json['maxAppointmentsPerDay'], 100),
      closedDays: Json.stringList(json['closedDays']),
      closedDates: Json.stringList(json['closedDates']),
      isActive: Json.boolOf(json['isActive'], fallback: true),
    );
  }
}
