import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/appointment.dart';
import '../../auth/application/auth_controller.dart';
import '../data/booking_repository.dart';
import 'booking_draft.dart';

/// Owns the citizen's request list.
///
/// The web dashboard polls `/api/bookings/my` every 5 seconds; the mobile app
/// uses a slower 20 second cadence to be gentler on battery and mobile data,
/// with pull to refresh for anything more immediate.
class AppointmentsController extends AsyncNotifier<List<Appointment>> {
  Timer? _poller;

  @override
  Future<List<Appointment>> build() async {
    final auth = ref.watch(authControllerProvider);
    if (!auth.isAuthenticated) return const [];

    _poller?.cancel();
    _poller = Timer.periodic(const Duration(seconds: 20), (_) => _silentRefresh());
    ref.onDispose(() => _poller?.cancel());

    return ref.read(bookingRepositoryProvider).myAppointments();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(
      () => ref.read(bookingRepositoryProvider).myAppointments(),
    );
  }

  /// Refresh without flipping the UI back into a loading state.
  Future<void> _silentRefresh() async {
    try {
      final data = await ref.read(bookingRepositoryProvider).myAppointments();
      state = AsyncData(data);
    } catch (_) {
      // Transient failures are ignored; the visible data stays as it was.
    }
  }

  Future<Appointment> submitDraft(BookingDraft draft, String otpToken) async {
    final appointment = await ref
        .read(bookingRepositoryProvider)
        .create(draft.bodyWithToken(otpToken));
    await refresh();
    return appointment;
  }

  Future<Appointment> cancel(String id, {String? reason}) async {
    final appointment =
        await ref.read(bookingRepositoryProvider).cancel(id, reason: reason);
    await refresh();
    return appointment;
  }

  Future<Appointment> resubmit(String id, Map<String, dynamic> details) async {
    final appointment = await ref.read(bookingRepositoryProvider).resubmit(id, details);
    await refresh();
    return appointment;
  }
}

final appointmentsControllerProvider =
    AsyncNotifierProvider<AppointmentsController, List<Appointment>>(
  AppointmentsController.new,
);

/// Requests that are still open, newest first.
final activeAppointmentsProvider = Provider<List<Appointment>>((ref) {
  final data = ref.watch(appointmentsControllerProvider).value ?? const [];
  return data.where((appointment) => appointment.isActive).toList();
});

/// Completed, cancelled or rejected requests.
final appointmentHistoryProvider = Provider<List<Appointment>>((ref) {
  final data = ref.watch(appointmentsControllerProvider).value ?? const [];
  return data.where((appointment) => !appointment.isActive).toList();
});

/// The request the home screen highlights and the queue screen tracks.
final currentAppointmentProvider = Provider<Appointment?>((ref) {
  final active = ref.watch(activeAppointmentsProvider);
  for (final appointment in active) {
    if (appointment.isTrackable) return appointment;
  }
  return active.isEmpty ? null : active.first;
});

final appointmentByIdProvider = Provider.family<Appointment?, String>((ref, id) {
  final data = ref.watch(appointmentsControllerProvider).value ?? const [];
  for (final appointment in data) {
    if (appointment.id == id || appointment.reference == id) return appointment;
  }
  return null;
});
