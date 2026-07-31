import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/role_drawer.dart';
import '../../../shared/widgets/state_views.dart';
import '../../../shared/widgets/stat_card.dart';
import '../../auth/application/auth_controller.dart';
import '../application/admin_dashboard_controller.dart';

/// Admin-only dashboard — never shows citizen National ID booking shortcuts.
class AdminHomeScreen extends ConsumerWidget {
  const AdminHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(adminDashboardProvider);
    final user = ref.watch(currentUserProvider);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return dashboard.when(
      loading: () => const LoadingView(message: 'Loading admin dashboard…'),
      error: (error, _) => ErrorStateView(
        error: error,
        onRetry: () => ref.invalidate(adminDashboardProvider),
      ),
      data: (data) {
        final stats = data.stats;
        final pending = data.appointments
            .where((a) {
              final s = a.requestStatus.isNotEmpty ? a.requestStatus : a.status;
              return s == 'Waiting' ||
                  s == 'Pending' ||
                  s == RequestStatus.resubmissionRequired;
            })
            .take(5)
            .toList();
        final waiting = data.appointments
            .where((a) => a.status == TicketStatus.waiting || a.status == 'Being Served')
            .take(5)
            .toList();
        final recent = data.appointments.take(5).toList();
        final activities = stats.recentActivities.take(6).toList();

        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(adminDashboardProvider),
          child: ListView(
            primary: true,
            physics: const AlwaysScrollableScrollPhysics(
              parent: ClampingScrollPhysics(),
            ),
            padding: EdgeInsets.only(bottom: 100 + bottomInset),
            children: [
              _AdminHeader(
                name: user?.displayName ?? 'Admin',
                onOpenMenu: () => ShellDrawerScope.maybeOf(context)?.openDrawer(),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Operations overview',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    _StatGrid(
                      cards: [
                        (
                          'Total Citizens',
                          '${stats.totalCitizens > 0 ? stats.totalCitizens : stats.totalUsers}',
                          Icons.people_rounded,
                          AppColors.primary,
                          () => context.push(AppRoutes.adminUsers),
                        ),
                        (
                          'Active Operators',
                          '${stats.activeOperators}',
                          Icons.badge_rounded,
                          AppColors.accent,
                          () => context.push(AppRoutes.adminOperators),
                        ),
                        (
                          'Pending Requests',
                          '${data.pendingRequests}',
                          Icons.pending_actions_rounded,
                          AppColors.warning,
                          () => context.push('${AppRoutes.adminRequests}?filter=pending'),
                        ),
                        (
                          'Approved Today',
                          '${data.approvedToday}',
                          Icons.check_circle_outline_rounded,
                          AppColors.success,
                          () => context.push(AppRoutes.adminAppointments),
                        ),
                        (
                          'Service Centers',
                          '${stats.serviceCenters}',
                          Icons.location_city_rounded,
                          AppColors.info,
                          () => context.push(AppRoutes.adminCenters),
                        ),
                        (
                          'Waiting Queue',
                          '${stats.waitingQueue}',
                          Icons.groups_rounded,
                          AppColors.primaryDark,
                          () => context.go(AppRoutes.adminQueue),
                        ),
                        (
                          'Lost ID Requests',
                          '${data.lostIdRequests}',
                          Icons.credit_card_off_rounded,
                          AppColors.danger,
                          () => context.push('${AppRoutes.adminAppointments}?filter=lost'),
                        ),
                        (
                          'Update Requests',
                          '${data.updateRequests}',
                          Icons.edit_note_rounded,
                          const Color(0xFF0EA5E9),
                          () => context.push('${AppRoutes.adminAppointments}?filter=update'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 22),
                    SectionHeader(
                      title: 'Recent appointments',
                      actionLabel: 'See all',
                      onAction: () => context.push(AppRoutes.adminAppointments),
                    ),
                    if (recent.isEmpty)
                      const _EmptyCard('No recent appointments yet.')
                    else
                      ...recent.map((a) => _BookingTile(appointment: a)),
                    const SizedBox(height: 18),
                    SectionHeader(
                      title: 'Pending requests',
                      actionLabel: 'Open',
                      onAction: () =>
                          context.push('${AppRoutes.adminRequests}?filter=pending'),
                    ),
                    if (pending.isEmpty)
                      const _EmptyCard('No pending requests right now.')
                    else
                      ...pending.map((a) => _BookingTile(appointment: a)),
                    const SizedBox(height: 18),
                    SectionHeader(
                      title: 'Live queue summary',
                      actionLabel: 'Queue',
                      onAction: () => context.go(AppRoutes.adminQueue),
                    ),
                    SectionCard(
                      child: Column(
                        children: [
                          _QueueStatRow(
                            label: 'Waiting now',
                            value: '${stats.waitingQueue}',
                            color: AppColors.warning,
                          ),
                          const Divider(height: 18),
                          _QueueStatRow(
                            label: 'In queue list',
                            value: '${waiting.length}',
                            color: AppColors.info,
                          ),
                          if (waiting.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            ...waiting.map(
                              (a) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        a.reference.isEmpty ? a.citizenName : a.reference,
                                        style: const TextStyle(fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                    StatusChip(status: a.status, dense: true),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    SectionHeader(
                      title: 'Recent activity',
                      actionLabel: 'Logs',
                      onAction: () => context.push(AppRoutes.adminActivity),
                    ),
                    if (activities.isEmpty)
                      const _EmptyCard('Activity will appear as staff work.')
                    else
                      SectionCard(
                        child: Column(
                          children: [
                            for (var i = 0; i < activities.length; i++) ...[
                              if (i > 0) const Divider(height: 18),
                              _ActivityRow(row: activities[i]),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.cards});

  final List<(String, String, IconData, Color, VoidCallback)> cards;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < cards.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  label: cards[i].$1,
                  value: cards[i].$2,
                  icon: cards[i].$3,
                  color: cards[i].$4,
                  onTap: cards[i].$5,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: i + 1 < cards.length
                    ? StatCard(
                        label: cards[i + 1].$1,
                        value: cards[i + 1].$2,
                        icon: cards[i + 1].$3,
                        color: cards[i + 1].$4,
                        onTap: cards[i + 1].$5,
                      )
                    : const SizedBox(),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _BookingTile extends StatelessWidget {
  const _BookingTile({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SectionCard(
        onTap: () => context.push(AppRoutes.adminBookingDetail(appointment.id)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    appointment.reference.isEmpty ? appointment.id : appointment.reference,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                StatusChip(
                  status: appointment.requestStatus.isNotEmpty
                      ? appointment.requestStatus
                      : appointment.status,
                  dense: true,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              appointment.citizenName.isEmpty
                  ? appointment.requestTypeLabel
                  : appointment.citizenName,
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
            if (appointment.hasAppointmentSlot) ...[
              const SizedBox(height: 4),
              Text(
                '${Formatters.readableDate(appointment.date)} · ${appointment.timeSlot ?? '--'}',
                style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QueueStatRow extends StatelessWidget {
  const _QueueStatRow({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ],
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.row});

  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final action = '${row['action'] ?? row['type'] ?? row['event'] ?? 'Activity'}';
    final time = '${row['time'] ?? row['createdAt'] ?? ''}';
    final ref = '${row['ref'] ?? row['reference'] ?? ''}';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.history_rounded, size: 18, color: AppColors.muted),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(action, style: const TextStyle(fontWeight: FontWeight.w600)),
              if (ref.isNotEmpty || time.isNotEmpty)
                Text(
                  [if (ref.isNotEmpty) ref, if (time.isNotEmpty) time].join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Text(message, style: const TextStyle(color: AppColors.muted)),
    );
  }
}

class _AdminHeader extends StatelessWidget {
  const _AdminHeader({required this.name, required this.onOpenMenu});

  final String name;
  final VoidCallback? onOpenMenu;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        8,
        MediaQuery.paddingOf(context).top + 8,
        16,
        20,
      ),
      decoration: const BoxDecoration(
        color: AppColors.navyDeepest,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onOpenMenu,
            icon: const Icon(Icons.menu_rounded, color: Colors.white, size: 26),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome, ${name.trim().split(RegExp(r'\s+')).first}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Administrator dashboard',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              'Admin',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
