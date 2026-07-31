import '../../core/utils/formatters.dart';
import '../../core/utils/json_utils.dart';

/// `GET /api/bookings/availability?centerId=&start=&end=` payload.
class Availability {
  const Availability({
    required this.centerId,
    required this.timeSlots,
    required this.days,
  });

  final String centerId;
  final List<String> timeSlots;

  /// Keyed by `yyyy-MM-dd`, exactly as the backend returns it.
  final Map<String, DayAvailability> days;

  DayAvailability? forDate(DateTime date) => days[Formatters.apiDate(date)];

  bool isSelectable(DateTime date) => forDate(date)?.isAvailable ?? false;

  /// Slots still open on [date]: the full grid minus the ones already taken.
  List<String> slotsFor(DateTime date) {
    final day = forDate(date);
    if (day == null || !day.isAvailable) return const [];
    return timeSlots.where((slot) => !day.bookedSlots.contains(slot)).toList();
  }

  factory Availability.fromJson(Map<String, dynamic> json) {
    final rawDates = Json.map(json['dates']);
    return Availability(
      centerId: Json.str(json['centerId']),
      timeSlots: Json.stringList(json['timeSlots']),
      days: rawDates.map(
        (key, value) => MapEntry(key, DayAvailability.fromJson(Json.map(value))),
      ),
    );
  }
}

class DayAvailability {
  const DayAvailability({required this.status, this.bookedSlots = const []});

  /// `available`, `closed` or `full`.
  final String status;
  final List<String> bookedSlots;

  bool get isAvailable => status == 'available';
  bool get isFull => status == 'full';
  bool get isClosed => status == 'closed';

  factory DayAvailability.fromJson(Map<String, dynamic> json) => DayAvailability(
        status: Json.str(json['status'], 'closed'),
        bookedSlots: Json.stringList(json['bookedSlots']),
      );
}
