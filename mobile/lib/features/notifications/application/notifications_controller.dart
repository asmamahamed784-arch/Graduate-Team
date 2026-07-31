import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/app_notification.dart';
import '../../auth/application/auth_controller.dart';
import '../data/notification_repository.dart';

/// Mirrors the web `NotificationContext`: an initial fetch plus a periodic
/// refresh, with the unread badge computed on the client.
class NotificationsController extends AsyncNotifier<List<AppNotification>> {
  Timer? _poller;

  @override
  Future<List<AppNotification>> build() async {
    final auth = ref.watch(authControllerProvider);
    if (!auth.isAuthenticated) return const [];

    _poller?.cancel();
    _poller = Timer.periodic(const Duration(seconds: 30), (_) => _silentRefresh());
    ref.onDispose(() => _poller?.cancel());

    return ref.read(notificationRepositoryProvider).list();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(
      () => ref.read(notificationRepositoryProvider).list(),
    );
  }

  Future<void> _silentRefresh() async {
    try {
      state = AsyncData(await ref.read(notificationRepositoryProvider).list());
    } catch (_) {}
  }

  Future<void> markRead(String id) async {
    // Optimistic: flip the badge immediately, reconcile with the server after.
    _patch((notification) =>
        notification.id == id ? notification.copyWith(read: true) : notification);
    try {
      await ref.read(notificationRepositoryProvider).markRead(id);
    } catch (_) {
      await refresh();
    }
  }

  Future<void> markAllRead() async {
    _patch((notification) => notification.copyWith(read: true));
    try {
      await ref.read(notificationRepositoryProvider).markAllRead();
    } catch (_) {
      await refresh();
    }
  }

  Future<void> dismiss(String id) async {
    final previous = state.value ?? const <AppNotification>[];
    state = AsyncData(previous.where((notification) => notification.id != id).toList());
    try {
      await ref.read(notificationRepositoryProvider).dismiss(id);
    } catch (_) {
      state = AsyncData(previous);
      rethrow;
    }
  }

  void _patch(AppNotification Function(AppNotification) transform) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(current.map(transform).toList());
  }
}

final notificationsControllerProvider =
    AsyncNotifierProvider<NotificationsController, List<AppNotification>>(
  NotificationsController.new,
);

final unreadNotificationCountProvider = Provider<int>((ref) {
  final notifications =
      ref.watch(notificationsControllerProvider).value ?? const [];
  return notifications.where((notification) => !notification.read).length;
});
