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
    this.currentQueueSize = 0,
    this.estimatedWaitMinutes = 0,
    this.availableServices = const [],
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
  final int currentQueueSize;
  final int estimatedWaitMinutes;
  final List<String> availableServices;

  bool get isActive => status.toLowerCase() == 'active' && schedule.isActive;

  String get location {
    final parts = [address, city, district].where((p) => p.trim().isNotEmpty).toSet();
    return parts.isEmpty ? 'Location not provided' : parts.join(', ');
  }

  /// Citizen-facing Open / Busy / Closed for the centers list.
  String get operationalStatus {
    if (!isActive || !schedule.isOpenOn(DateTime.now())) return 'Closed';
    final queue = displayQueueSize;
    final busyThreshold = capacity > 0
        ? (capacity * 0.7).ceil()
        : (schedule.maxAppointmentsPerDay * 0.7).ceil();
    if (queue > 0 && queue >= busyThreshold) return 'Busy';
    return 'Open';
  }

  int get displayQueueSize {
    if (currentQueueSize > 0) return currentQueueSize;
    return 0;
  }

  String get displayEstimatedWait {
    if (estimatedWaitMinutes > 0) return '$estimatedWaitMinutes min';
    final queue = displayQueueSize;
    if (queue <= 0) return '~${schedule.slotDuration} min';
    return '~${queue * schedule.slotDuration} min';
  }

  List<String> get displayServices {
    if (availableServices.isNotEmpty) return availableServices;
    return const [
      'New Registration',
      'Update Information',
      'Lost ID Replacement',
    ];
  }

  String get hoursLabel {
    if (hours.trim().isNotEmpty) return hours;
    return '${schedule.startTime} – ${schedule.endTime}';
  }

  factory CenterModel.fromJson(Map<String, dynamic> json) {
    final servicesRaw = json['availableServices'] ?? json['services'];
    return CenterModel(
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
      currentQueueSize: Json.intOf(
        json['currentQueueSize'] ?? json['queueSize'] ?? json['waitingCount'],
      ),
      estimatedWaitMinutes: Json.intOf(
        json['estimatedWaitMinutes'] ?? json['estimatedWait'],
      ),
      availableServices: servicesRaw is List
          ? servicesRaw.map((e) => '$e').where((e) => e.trim().isNotEmpty).toList()
          : const [],
    );
  }
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

  static const _weekdays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  /// True when this center accepts appointments on [date]
  /// (working day and not in closed/holiday dates).
  bool isOpenOn(DateTime date) {
    if (!isActive) return false;
    final day = DateTime(date.year, date.month, date.day);
    final weekday = _weekdays[day.weekday - 1];
    final key =
        '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    final closed = {
      for (final raw in closedDates)
        if (raw.trim().length >= 10) raw.trim().substring(0, 10),
    };
    if (closed.contains(key)) return false;
    if (closedDays.contains(weekday)) return false;
    if (workingDays.isNotEmpty && !workingDays.contains(weekday)) return false;
    return true;
  }

  factory CenterSchedule.fromJson(Map<String, dynamic> json) {
    if (json.isEmpty) return const CenterSchedule();
    final working = Json.stringList(json['workingDays']);
    final closedDayList = Json.stringList(json['closedDays']);
    return CenterSchedule(
      workingDays: working.isEmpty
          ? const ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
          : working,
      startTime: Json.str(json['startTime'], '08:00'),
      endTime: Json.str(json['endTime'], '16:00'),
      slotDuration: Json.intOf(json['slotDuration'], 30),
      maxBookingsPerSlot: Json.intOf(json['maxBookingsPerSlot'], 5),
      maxAppointmentsPerDay: Json.intOf(json['maxAppointmentsPerDay'], 100),
      closedDays: closedDayList,
      closedDates: Json.stringList(json['closedDates'])
          .map((d) => d.trim())
          .where((d) => d.length >= 10)
          .map((d) => d.substring(0, 10))
          .toList(),
      isActive: Json.boolOf(json['isActive'], fallback: true),
    );
  }
}
