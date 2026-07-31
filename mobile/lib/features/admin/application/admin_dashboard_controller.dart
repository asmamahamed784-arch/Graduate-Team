import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../shared/models/appointment.dart';
import '../data/admin_repository.dart';
import '../models/admin_models.dart';

class AdminDashboardData {
  const AdminDashboardData({
    required this.stats,
    required this.appointments,
    required this.pendingRequests,
    required this.approvedToday,
    required this.lostIdRequests,
    required this.updateRequests,
  });

  final AdminDashboardStats stats;
  final List<Appointment> appointments;
  final int pendingRequests;
  final int approvedToday;
  final int lostIdRequests;
  final int updateRequests;
}

final adminDashboardProvider = FutureProvider.autoDispose<AdminDashboardData>((ref) async {
  final repo = ref.watch(adminRepositoryProvider);
  final results = await Future.wait([
    repo.dashboardStats(),
    repo.allBookings(),
  ]);
  final stats = results[0] as AdminDashboardStats;
  final appointments = results[1] as List<Appointment>;

  final today = DateTime.now();
  final todayKey =
      '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

  String statusOf(Appointment a) =>
      a.requestStatus.isNotEmpty ? a.requestStatus : a.status;

  final pending = appointments.where((a) {
    final s = statusOf(a);
    return s == 'Waiting' || s == 'Pending' || s == RequestStatus.resubmissionRequired;
  }).length;

  final approvedToday = appointments.where((a) {
    final date = a.date.length >= 10 ? a.date.substring(0, 10) : a.date;
    final s = statusOf(a);
    return date == todayKey && (s == 'Approved' || s == 'Completed');
  }).length;

  final lost = appointments
      .where((a) => a.requestType == RequestTypes.lostReplacement)
      .length;
  final updates = appointments
      .where((a) => a.requestType == RequestTypes.updateInformation)
      .length;

  return AdminDashboardData(
    stats: stats,
    appointments: appointments,
    pendingRequests: pending,
    approvedToday: approvedToday,
    lostIdRequests: stats.lostIdRequests > 0 ? stats.lostIdRequests : lost,
    updateRequests: stats.updateRequests > 0 ? stats.updateRequests : updates,
  );
});

final adminBookingsProvider = FutureProvider.autoDispose<List<Appointment>>((ref) async {
  return ref.watch(adminRepositoryProvider).allBookings();
});

final adminUsersProvider = FutureProvider.autoDispose<List<AdminUserRow>>((ref) {
  return ref.watch(adminRepositoryProvider).users();
});

final adminOperatorsProvider = FutureProvider.autoDispose<List<AdminOperatorRow>>((ref) {
  return ref.watch(adminRepositoryProvider).operators();
});

final adminSessionsProvider = FutureProvider.autoDispose<List<AdminSessionRow>>((ref) {
  return ref.watch(adminRepositoryProvider).sessions();
});

final adminActivitiesProvider = FutureProvider.autoDispose<List<AdminActivityRow>>((ref) {
  return ref.watch(adminRepositoryProvider).activities();
});

final adminServicesProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(adminRepositoryProvider).services();
});

final adminCentersProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(adminRepositoryProvider).centers();
});

final adminAnalyticsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(adminRepositoryProvider).analytics();
});
