import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/models/queue_status.dart';

class QueueRepository {
  const QueueRepository(this._api);

  final ApiClient _api;

  /// `GET /api/queue/track/:ref` — position, people ahead and estimated wait.
  Future<QueueStatus> track(String reference) async {
    final data = await _api.getObject(
      ApiEndpoints.trackTicket(reference.trim().toUpperCase()),
    );
    return QueueStatus.fromJson(data);
  }

  /// `GET /api/queue/live/:centerId` — public board of a center's queue.
  Future<List<Appointment>> liveQueue(String centerId) async {
    final rows = await _api.getList(ApiEndpoints.liveQueue(centerId), skipAuth: true);
    return rows.map(Appointment.fromJson).toList();
  }
}

final queueRepositoryProvider = Provider<QueueRepository>(
  (ref) => QueueRepository(ref.watch(apiClientProvider)),
);
