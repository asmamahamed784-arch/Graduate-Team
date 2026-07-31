import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/models/availability.dart';

class BookingRepository {
  const BookingRepository(this._api);

  final ApiClient _api;

  /// `GET /api/bookings/my` — every request made by the signed-in citizen,
  /// newest first.
  Future<List<Appointment>> myAppointments() async {
    final rows = await _api.getList(ApiEndpoints.myBookings);
    final appointments = rows.map(Appointment.fromJson).toList()
      ..sort((a, b) {
        final left = a.createdAt ?? DateTime(1970);
        final right = b.createdAt ?? DateTime(1970);
        return right.compareTo(left);
      });
    return appointments;
  }

  /// Accepts either a UUID or a `REQ-1234` reference.
  Future<Appointment> byReference(String refOrId) async =>
      Appointment.fromJson(await _api.getObject(ApiEndpoints.booking(refOrId)));

  Future<Availability> availability({
    required String centerId,
    required DateTime start,
    required DateTime end,
  }) async {
    final data = await _api.getObject(
      ApiEndpoints.bookingAvailability,
      query: {
        'centerId': centerId,
        'start': Formatters.apiDate(start),
        'end': Formatters.apiDate(end),
      },
    );
    return Availability.fromJson(data);
  }

  /// `POST /api/bookings` — the body must already contain the `otpToken`
  /// returned by `POST /api/otp/verify`.
  Future<Appointment> create(Map<String, dynamic> body) async =>
      Appointment.fromJson(await _api.post(ApiEndpoints.bookings, body: body));

  Future<Appointment> cancel(String id, {String? reason}) async {
    final data = await _api.put(
      ApiEndpoints.cancelBooking(id),
      body: {if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim()},
    );
    return Appointment.fromJson(data);
  }

  /// Resubmitting a corrected request does not need a new OTP.
  Future<Appointment> resubmit(String id, Map<String, dynamic> details) async =>
      Appointment.fromJson(await _api.put(ApiEndpoints.resubmitBooking(id), body: details));

  /// `GET /api/qr/generate` returns a `data:image/png;base64,...` string.
  Future<String> qrDataUrl(String reference) async {
    final data = await _api.getRaw(
      ApiEndpoints.qrGenerate,
      query: {'text': reference},
    );
    return data is String ? data : '';
  }
}

final bookingRepositoryProvider = Provider<BookingRepository>(
  (ref) => BookingRepository(ref.watch(apiClientProvider)),
);
