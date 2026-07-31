import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/app_notification.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/notifications_controller.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsControllerProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: () =>
                  ref.read(notificationsControllerProvider.notifier).markAllRead(),
              child: const Text(
                'Mark all read',
                style: TextStyle(color: Colors.white),
              ),
            ),
        ],
      ),
      body: notifications.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.read(notificationsControllerProvider.notifier).refresh(),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () => ref.read(notificationsControllerProvider.notifier).refresh(),
          child: items.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: const EmptyStateView(
                        icon: Icons.notifications_none_rounded,
                        title: 'No notifications yet',
                        message:
                            'Updates about your requests and appointments will appear here.',
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) =>
                      _NotificationTile(notification: items[index]),
                ),
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});

  final AppNotification notification;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(notificationsControllerProvider.notifier);

    return Dismissible(
      key: ValueKey(notification.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
      ),
      onDismissed: (_) async {
        try {
          await controller.dismiss(notification.id);
        } on ApiException catch (error) {
          if (context.mounted) showAppSnackBar(context, error.message, isError: true);
        }
      },
      child: SectionCard(
        onTap: () {
          if (!notification.read) controller.markRead(notification.id);
          final reference = notification.referenceNumber;
          if (reference.isNotEmpty) context.push(AppRoutes.trackRef(reference));
        },
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: _color(notification).withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(_icon(notification), size: 19, color: _color(notification)),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            fontWeight:
                                notification.read ? FontWeight.w500 : FontWeight.w700,
                          ),
                        ),
                      ),
                      if (!notification.read)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    notification.description,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (notification.referenceNumber.isNotEmpty) ...[
                        Text(
                          notification.referenceNumber,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.accent,
                          ),
                        ),
                        const SizedBox(width: 10),
                      ],
                      Text(
                        Formatters.relative(notification.timestamp),
                        style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _icon(AppNotification notification) {
    final type = notification.notificationType.toUpperCase();
    if (type.contains('CANCEL')) return Icons.event_busy_rounded;
    if (type.contains('APPROVE') || type.contains('COMPLETE')) {
      return Icons.check_circle_outline_rounded;
    }
    if (type.contains('CORRECTION') || type.contains('REJECT')) {
      return Icons.error_outline_rounded;
    }
    if (type.contains('APPOINTMENT')) return Icons.event_available_rounded;
    return Icons.notifications_none_rounded;
  }

  Color _color(AppNotification notification) {
    final type = notification.notificationType.toUpperCase();
    if (type.contains('CANCEL') || type.contains('REJECT')) return AppColors.danger;
    if (type.contains('APPROVE') || type.contains('COMPLETE')) return AppColors.success;
    if (type.contains('CORRECTION')) return AppColors.warning;
    return AppColors.accent;
  }
}
