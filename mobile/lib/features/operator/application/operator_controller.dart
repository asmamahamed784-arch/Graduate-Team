import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/appointment.dart';
import '../data/operator_repository.dart';
import '../models/operator_models.dart';

final operatorDashboardProvider =
    FutureProvider.autoDispose<OperatorDashboardData>((ref) async {
  return ref.watch(operatorRepositoryProvider).getDashboard();
});

final operatorQueueProvider =
    FutureProvider.autoDispose<List<Appointment>>((ref) async {
  return ref.watch(operatorRepositoryProvider).getQueue();
});

final operatorQueueDataProvider =
    FutureProvider.autoDispose<OperatorQueueData>((ref) async {
  return ref.watch(operatorRepositoryProvider).getQueueData();
});

/// Refreshes dashboard and queue providers after an operator action.
void refreshOperatorData(WidgetRef ref) {
  ref.invalidate(operatorDashboardProvider);
  ref.invalidate(operatorQueueProvider);
  ref.invalidate(operatorQueueDataProvider);
}
