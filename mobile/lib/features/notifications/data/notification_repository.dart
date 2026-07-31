import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../shared/models/app_notification.dart';

class NotificationRepository {
  const NotificationRepository(this._api);

  final ApiClient _api;

  Future<List<AppNotification>> list() async {
    final rows = await _api.getList(ApiEndpoints.notifications);
    final notifications = rows.map(AppNotification.fromJson).toList()
      ..sort((a, b) {
        final left = a.timestamp ?? DateTime(1970);
        final right = b.timestamp ?? DateTime(1970);
        return right.compareTo(left);
      });
    return notifications;
  }

  Future<void> markRead(String id) => _api.put(ApiEndpoints.notificationRead(id));

  Future<void> markAllRead() => _api.put(ApiEndpoints.notificationsReadAll);

  Future<void> dismiss(String id) => _api.delete(ApiEndpoints.notification(id));
}

final notificationRepositoryProvider = Provider<NotificationRepository>(
  (ref) => NotificationRepository(ref.watch(apiClientProvider)),
);
