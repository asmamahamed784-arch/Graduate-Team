import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/app_notification.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/nqs_page_header.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../appointments/data/booking_repository.dart';
import '../../home/presentation/home_shell.dart';
import '../application/notifications_controller.dart';

/// Pulls REQ-/NQS- refs from notification fields the same way the web does.
String notificationTicketReference(AppNotification notification) {
  final direct = notification.referenceNumber.trim();
  if (direct.isNotEmpty) return direct.toUpperCase();

  final source =
      '${notification.title} ${notification.description} ${notification.cancellationReason}';
  final match =
      RegExp(r'\b(?:REQ|NQS)-\d+\b', caseSensitive: false).firstMatch(source);
  return match?.group(0)?.toUpperCase() ?? '';
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  static const _filters = ['All', 'Unread', 'Appointment', 'Queue', 'System'];

  String _filter = 'All';

  bool _matches(AppNotification n) {
    if (_filter == 'All') return true;
    if (_filter == 'Unread') return !n.read;

    final cat = n.category.toLowerCase();
    final type = n.notificationType.toLowerCase();
    final text = '${n.title} ${n.description}'.toLowerCase();
    switch (_filter) {
      case 'Appointment':
        return cat.contains('appoint') ||
            type.contains('appoint') ||
            text.contains('appointment') ||
            cat.contains('request') ||
            text.contains('request') ||
            text.contains('submitted') ||
            type.contains('correct') ||
            text.contains('correct') ||
            text.contains('resubmit');
      case 'Queue':
        return cat.contains('queue') ||
            type.contains('queue') ||
            text.contains('queue') ||
            text.contains('serving');
      case 'System':
        return cat.contains('system') ||
            (!cat.contains('appoint') &&
                !cat.contains('request') &&
                !text.contains('queue') &&
                !text.contains('correct'));
      default:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final notifications = ref.watch(notificationsControllerProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    final header = NqsPageHeader(
      icon: Icons.notifications_rounded,
      iconColor: AppColors.primary,
      title: 'Notifications',
      subtitle: unread > 0
          ? '$unread unread ${unread == 1 ? 'update' : 'updates'}'
          : 'Updates on your requests',
      onMenu: () => HomeShellScope.maybeOf(context)?.openDrawer(),
      trailing: unread > 0
          ? OutlinedButton(
              onPressed: () => ref
                  .read(notificationsControllerProvider.notifier)
                  .markAllRead(),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 32),
                padding: const EdgeInsets.symmetric(horizontal: 10),
                textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
              ),
              child: const Text('Mark all read'),
            )
          : null,
    );

    return Scaffold(
      backgroundColor: AppSurface.background(context),
      body: notifications.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () =>
              ref.read(notificationsControllerProvider.notifier).refresh(),
        ),
        data: (items) {
          final filtered = items.where(_matches).toList();
          return RefreshIndicator(
            onRefresh: () =>
                ref.read(notificationsControllerProvider.notifier).refresh(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: tabListPadding(context),
              children: [
                header,
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final filter in _filters) ...[
                        FilterChip(
                          label: Text(filter),
                          selected: _filter == filter,
                          onSelected: (_) => setState(() => _filter = filter),
                          selectedColor: AppColors.primarySoft,
                          checkmarkColor: AppColors.primary,
                          labelStyle: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: _filter == filter
                                ? AppColors.primary
                                : AppColors.muted,
                            fontSize: 12.5,
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (filtered.isEmpty)
                  const AppCard(
                    padding: EdgeInsets.zero,
                    child: EmptyStateView(
                      icon: Icons.notifications_none_rounded,
                      title: 'No notifications',
                      message:
                          'Updates about appointments, queue and corrections appear here.',
                    ),
                  )
                else
                  for (var i = 0; i < filtered.length; i++) ...[
                    if (i > 0) const SizedBox(height: 10),
                    _NotificationTile(notification: filtered[i]),
                  ],
              ],
            ),
          );
        },
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
    final reference = notificationTicketReference(notification);

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
          if (context.mounted) {
            showAppSnackBar(context, error.message, isError: true);
          }
        }
      },
      child: Material(
        color: _color(notification).withValues(
          alpha: AppSurface.isDark(context) ? 0.16 : 0.08,
        ),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => openNotificationTarget(context, ref, notification),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _color(notification).withValues(alpha: 0.28),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SoftIconBadge(
                  icon: _icon(notification),
                  color: _color(notification),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (!notification.read)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(right: 7),
                              decoration: const BoxDecoration(
                                color: AppColors.info,
                                shape: BoxShape.circle,
                              ),
                            ),
                          Expanded(
                            child: Text(
                              notification.title,
                              style: TextStyle(
                                color: AppSurface.ink(context),
                                fontSize: 13.5,
                                fontWeight: notification.read
                                    ? FontWeight.w600
                                    : FontWeight.w800,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.muted,
                            size: 20,
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        notification.description,
                        style: TextStyle(
                          color: AppSurface.muted(context),
                          fontSize: 12.5,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          if (reference.isNotEmpty) ...[
                            Text(
                              reference,
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.info,
                              ),
                            ),
                            const SizedBox(width: 10),
                          ],
                          Text(
                            Formatters.relative(notification.timestamp),
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppSurface.muted(context),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
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
    if (type.contains('CANCEL') || type.contains('REJECT')) {
      return AppColors.danger;
    }
    if (type.contains('APPROVE') || type.contains('COMPLETE')) {
      return AppColors.success;
    }
    if (type.contains('CORRECTION')) return AppColors.warning;
    return AppColors.accent;
  }
}

/// Opens the related request details (including completed appointments).
Future<void> openNotificationTarget(
  BuildContext context,
  WidgetRef ref,
  AppNotification notification,
) async {
  final controller = ref.read(notificationsControllerProvider.notifier);
  if (!notification.read) {
    unawaited(controller.markRead(notification.id));
  }

  final router = GoRouter.of(context);
  final reference = notificationTicketReference(notification);
  final relatedId = notification.relatedEntity.trim();
  final text =
      '${notification.title} ${notification.description} ${notification.notificationType}'
          .toLowerCase();
  final isCompleted = text.contains('completed') ||
      notification.notificationType.toUpperCase().contains('COMPLETE');

  Future<void> openDetail(String idOrRef) async {
    final cached = ref.read(appointmentByIdProvider(idOrRef));
    if (cached != null && cached.id.isNotEmpty) {
      router.push(AppRoutes.appointmentDetail(cached.id));
      return;
    }
    try {
      final appointment =
          await ref.read(bookingRepositoryProvider).byReference(idOrRef);
      unawaited(ref.read(appointmentsControllerProvider.notifier).refresh());
      if (appointment.id.isEmpty) return;

      final wantsCorrection = notification.notificationType
              .toLowerCase()
              .contains('correct') ||
          text.contains('correct') ||
          appointment.needsResubmission;

      if (wantsCorrection && !isCompleted) {
        router.push(AppRoutes.correction(appointment.id));
      } else {
        router.push(AppRoutes.appointmentDetail(appointment.id));
      }
    } catch (_) {
      // Fall through — stay where we are / go requests.
    }
  }

  // Prefer explicit ticket id / reference from the notification.
  if (relatedId.isNotEmpty) {
    await openDetail(relatedId);
    return;
  }
  if (reference.isNotEmpty) {
    await openDetail(reference);
    return;
  }

  // Older "Appointment Completed" notifications had no ref — open latest completed.
  if (isCompleted) {
    await ref.read(appointmentsControllerProvider.notifier).refresh();
    final all = ref.read(appointmentsControllerProvider).value ?? const [];
    Appointment? completed;
    for (final a in all) {
      final done = a.status.toLowerCase() == 'completed' ||
          a.requestStatus.toLowerCase() == 'completed';
      if (done) {
        completed = a;
        break;
      }
    }
    if (completed != null) {
      router.push(AppRoutes.appointmentDetail(completed.id));
      return;
    }
  }

  router.go(AppRoutes.appointments);
}
