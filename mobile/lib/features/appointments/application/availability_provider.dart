import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/availability.dart';
import '../data/booking_repository.dart';

/// Window of days the booking calendar offers, matching the web date picker.
const int kBookingWindowDays = 60;

/// Record key so Riverpod can compare family arguments by value.
typedef AvailabilityQuery = ({String centerId, String start, String end});

/// Auto-disposed: availability is only meaningful while the booking form for a
/// given center is open, and it goes stale as other citizens take slots.
final availabilityProvider = FutureProvider.family<Availability, AvailabilityQuery>(
  isAutoDispose: true,
  (ref, query) async {
    return ref.watch(bookingRepositoryProvider).availability(
          centerId: query.centerId,
          start: DateTime.parse(query.start),
          end: DateTime.parse(query.end),
        );
  },
);
