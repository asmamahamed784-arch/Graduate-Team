import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/nqs_page_header.dart';
import '../../../shared/widgets/state_views.dart';
import '../../home/presentation/home_shell.dart';
import '../application/appointments_controller.dart';

/// Appointments with a booked slot — All / Today / Upcoming / Completed / Cancelled.
class MyAppointmentsOverviewScreen extends ConsumerStatefulWidget {
  const MyAppointmentsOverviewScreen({super.key});

  @override
  ConsumerState<MyAppointmentsOverviewScreen> createState() =>
      _MyAppointmentsOverviewScreenState();
}

class _MyAppointmentsOverviewScreenState
    extends ConsumerState<MyAppointmentsOverviewScreen> {
  static const _tabLabels = ['All', 'Today', 'Upcoming', 'Completed', 'Cancelled'];

  int _tab = 0;

  bool _isToday(String date) {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return false;
    final now = DateTime.now();
    return parsed.year == now.year &&
        parsed.month == now.month &&
        parsed.day == now.day;
  }

  bool _isUpcoming(Appointment a) => a.isActive && !a.isCancelled;

  bool _isCompleted(Appointment a) =>
      a.requestStatus.toLowerCase() == 'completed' ||
      a.status.toLowerCase() == 'completed';

  List<Appointment> _filter(List<Appointment> withSlot, int tab) {
    switch (tab) {
      case 0:
        return withSlot;
      case 1:
        return withSlot.where((a) => _isToday(a.date)).toList();
      case 2:
        return withSlot.where(_isUpcoming).toList();
      case 3:
        return withSlot.where(_isCompleted).toList();
      default:
        return withSlot.where((a) => a.isCancelled).toList();
    }
  }

  String _emptyTitle(int tab) => switch (tab) {
    0 => 'No appointments yet',
    1 => 'No appointments today',
    2 => 'No upcoming appointments',
    3 => 'No completed appointments',
    _ => 'No cancelled appointments',
  };

  bool _emptyHasCta(int tab) => tab != 3 && tab != 4;

  @override
  Widget build(BuildContext context) {
    final appointments = ref.watch(appointmentsControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      body: appointments.when(
        loading: () => const LoadingView(message: 'Loading appointments'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () =>
              ref.read(appointmentsControllerProvider.notifier).refresh(),
        ),
        data: (all) {
          final withSlot = all.where((a) => a.hasAppointmentSlot).toList();
          final upcomingCount = withSlot.where(_isUpcoming).length;
          final completedCount = withSlot.where(_isCompleted).length;
          final cancelledCount = withSlot.where((a) => a.isCancelled).length;
          final items = _filter(withSlot, _tab);

          return RefreshIndicator(
            onRefresh: () =>
                ref.read(appointmentsControllerProvider.notifier).refresh(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
              children: [
                NqsPageHeader(
                  icon: Icons.calendar_month_rounded,
                  iconColor: AppColors.primary,
                  title: 'Appointments',
                  subtitle: 'Manage your NQS appointments',
                  onMenu: () => HomeShellScope.maybeOf(context)?.openDrawer(),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _StatTile(
                        label: 'Upcoming',
                        value: '$upcomingCount',
                        icon: Icons.calendar_month_rounded,
                        color: AppColors.info,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatTile(
                        label: 'Completed',
                        value: '$completedCount',
                        icon: Icons.check_circle_rounded,
                        color: AppColors.success,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatTile(
                        label: 'Cancelled',
                        value: '$cancelledCount',
                        icon: Icons.cancel_rounded,
                        color: AppColors.danger,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _tabLabels.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, i) => _FilterPill(
                      label: _tabLabels[i],
                      selected: _tab == i,
                      onTap: () => setState(() => _tab = i),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (items.isEmpty)
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.42,
                    child: EmptyStateView(
                      icon: Icons.event_available_outlined,
                      title: _emptyTitle(_tab),
                      message: _emptyHasCta(_tab)
                          ? 'Book a National ID service to see it here.'
                          : 'Appointments in this category will appear here.',
                      actionLabel: _emptyHasCta(_tab) ? 'Browse Services' : null,
                      onAction: _emptyHasCta(_tab)
                          ? () => context.go(AppRoutes.services)
                          : null,
                    ),
                  )
                else
                  for (var i = 0; i < items.length; i++) ...[
                    if (i > 0) const SizedBox(height: 10),
                    _AppointmentRow(appointment: items[i]),
                  ],
                if (upcomingCount > 0) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.15),
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(11),
                          ),
                          child: const Icon(
                            Icons.info_outline_rounded,
                            color: AppColors.primary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Need to reschedule or cancel?',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.navy,
                              fontSize: 12.8,
                            ),
                          ),
                        ),
                        FilledButton(
                          onPressed: () => setState(() => _tab = 2),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(0, 34),
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            textStyle: const TextStyle(fontSize: 12.5),
                          ),
                          child: const Text('Manage Appointment'),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 8),
          Text(
            value,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w900,
              color: AppColors.ink,
            ),
          ),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.navy : Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? AppColors.navy : AppColors.lightBorder,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : AppColors.ink,
              fontWeight: FontWeight.w700,
              fontSize: 12.5,
            ),
          ),
        ),
      ),
    );
  }
}

class _AppointmentRow extends StatelessWidget {
  const _AppointmentRow({required this.appointment});

  final Appointment appointment;

  ({IconData icon, Color color}) get _typeStyle => switch (appointment.requestType) {
    'new_national_id' => (icon: Icons.person_add_alt_1_rounded, color: const Color(0xFF2563EB)),
    'update_information' => (icon: Icons.edit_rounded, color: const Color(0xFF7C3AED)),
    'lost_replacement' => (icon: Icons.badge_rounded, color: const Color(0xFFD97706)),
    _ => (icon: Icons.description_rounded, color: AppColors.muted),
  };

  @override
  Widget build(BuildContext context) {
    final style = _typeStyle;
    final queueNumber =
        appointment.queueNumber.isNotEmpty ? appointment.queueNumber : appointment.ticketNumber;

    return AppCard(
      onTap: () => context.push(AppRoutes.appointmentDetail(appointment.id)),
      radius: 16,
      tintColor: style.color,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: style.color.withValues(alpha: 0.12),
            child: Icon(style.icon, color: style.color, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        appointment.serviceName.isEmpty
                            ? appointment.requestTypeLabel
                            : appointment.serviceName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                        ),
                      ),
                    ),
                    StatusChip(status: appointment.status, dense: true),
                  ],
                ),
                const SizedBox(height: 6),
                if (appointment.centerName.isNotEmpty)
                  _MetaLine(icon: Icons.location_on_outlined, text: appointment.centerName),
                if (appointment.hasAppointmentSlot)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: _MetaLine(
                      icon: Icons.event_outlined,
                      text: [
                        Formatters.readableDate(appointment.date),
                        if (appointment.timeSlot != null) appointment.timeSlot!,
                      ].join(' · '),
                    ),
                  ),
                if (queueNumber.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text(
                        'Queue No.',
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        queueNumber,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 12.5,
                          color: AppColors.navy,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
        ],
      ),
    );
  }
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 13, color: AppColors.muted),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
