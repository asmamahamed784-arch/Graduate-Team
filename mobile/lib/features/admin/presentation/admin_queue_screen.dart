import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/admin_dashboard_controller.dart';

class AdminQueueScreen extends ConsumerWidget {
  const AdminQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookings = ref.watch(adminBookingsProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Live Queue')),
      body: bookings.when(
        loading: () => const LoadingView(message: 'Loading queue…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminBookingsProvider),
        ),
        data: (items) {
          final waiting = items.where((a) => a.status == TicketStatus.waiting).toList();
          final serving = items.where((a) => a.status == TicketStatus.beingServed).toList();

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(adminBookingsProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _QueueSummary(waiting: waiting.length, serving: serving.length),
                const SizedBox(height: 20),
                const SectionHeader(title: 'Being served'),
                if (serving.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('No tickets currently being served.',
                        style: TextStyle(color: AppColors.muted)),
                  )
                else
                  ...serving.map(
                    (a) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _QueueTile(appointment: a, highlight: true),
                    ),
                  ),
                const SizedBox(height: 16),
                const SectionHeader(title: 'Waiting'),
                if (waiting.isEmpty)
                  const EmptyStateView(
                    title: 'Queue is empty',
                    message: 'No citizens are waiting right now.',
                    icon: Icons.hourglass_empty_rounded,
                  )
                else
                  ...waiting.map(
                    (a) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _QueueTile(appointment: a),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _QueueSummary extends StatelessWidget {
  const _QueueSummary({required this.waiting, required this.serving});

  final int waiting;
  final int serving;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: SectionCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Waiting', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                const SizedBox(height: 4),
                Text(
                  '$waiting',
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.warning),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: SectionCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Being served', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                const SizedBox(height: 4),
                Text(
                  '$serving',
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.info),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _QueueTile extends StatelessWidget {
  const _QueueTile({required this.appointment, this.highlight = false});

  final Appointment appointment;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      onTap: () => context.push(AppRoutes.adminBookingDetail(appointment.id)),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: (highlight ? AppColors.info : AppColors.warning).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              appointment.reference.length > 4
                  ? appointment.reference.substring(appointment.reference.length - 4)
                  : appointment.reference,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: highlight ? AppColors.info : AppColors.warning,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  appointment.citizenName.isNotEmpty ? appointment.citizenName : appointment.reference,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (appointment.centerName.isNotEmpty) appointment.centerName,
                    if (appointment.counter != '--') 'Counter ${appointment.counter}',
                  ].join(' • '),
                  style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusChip(status: appointment.status, dense: true),
              if (appointment.waitTime.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(appointment.waitTime, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
