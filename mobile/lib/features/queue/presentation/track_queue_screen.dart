import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/queue_status.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../application/queue_controller.dart';

/// Live queue position for a ticket reference, refreshed by Socket.IO pushes
/// and a 15 second poll.
class TrackQueueScreen extends ConsumerStatefulWidget {
  const TrackQueueScreen({super.key, this.initialReference});

  final String? initialReference;

  @override
  ConsumerState<TrackQueueScreen> createState() => _TrackQueueScreenState();
}

class _TrackQueueScreenState extends ConsumerState<TrackQueueScreen> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialReference ?? '');
  String? _reference;

  @override
  void initState() {
    super.initState();
    _reference = widget.initialReference?.trim().toUpperCase();
    if (_reference == null || _reference!.isEmpty) {
      // Default to the citizen's own active ticket when none was passed in.
      final current = ref.read(currentAppointmentProvider);
      if (current != null && current.isTrackable) {
        _reference = current.reference;
        _controller.text = current.reference;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _track() {
    final value = _controller.text.trim().toUpperCase();
    if (value.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() => _reference = value);
  }

  @override
  Widget build(BuildContext context) {
    final reference = _reference;

    return Scaffold(
      appBar: AppBar(title: const Text('Track queue')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    textCapitalization: TextCapitalization.characters,
                    onSubmitted: (_) => _track(),
                    decoration: const InputDecoration(
                      labelText: 'Ticket reference',
                      hintText: 'REQ-1234',
                      prefixIcon: Icon(Icons.confirmation_number_outlined),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  height: 54,
                  child: FilledButton(
                    onPressed: _track,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(84, 54),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: const Text('Track'),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: reference == null || reference.isEmpty
                ? const EmptyStateView(
                    icon: Icons.timeline_rounded,
                    title: 'Enter your ticket reference',
                    message:
                        'You will find it on your booking confirmation, for example REQ-1234.',
                  )
                : _QueueStatusView(reference: reference),
          ),
        ],
      ),
    );
  }
}

class _QueueStatusView extends ConsumerWidget {
  const _QueueStatusView({required this.reference});

  final String reference;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(queueTrackingProvider(reference));

    return status.when(
      loading: () => const LoadingView(message: 'Checking the queue'),
      error: (error, _) => ErrorStateView(
        error: error,
        onRetry: () => ref.invalidate(queueTrackingProvider(reference)),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(queueTrackingProvider(reference)),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            _PositionCard(status: data),
            const SizedBox(height: 20),
            const SectionHeader(title: 'Ticket'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Reference',
                    value: data.reference,
                    icon: Icons.confirmation_number_outlined,
                    copyable: true,
                  ),
                  DetailRow(
                    label: 'Service',
                    value: data.serviceName,
                    icon: Icons.assignment_outlined,
                  ),
                  DetailRow(
                    label: 'Center',
                    value: data.centerName,
                    icon: Icons.location_city_rounded,
                  ),
                  DetailRow(
                    label: 'Date',
                    value: Formatters.readableDate(data.appointmentDate),
                    icon: Icons.event_outlined,
                  ),
                  DetailRow(
                    label: 'Time',
                    value: data.timeSlot ?? '--',
                    icon: Icons.schedule_rounded,
                  ),
                  DetailRow(
                    label: 'Counter',
                    value: data.counter,
                    icon: Icons.desk_outlined,
                  ),
                  DetailRow(
                    label: 'Progress',
                    value: data.requestStatus,
                    icon: Icons.timeline_rounded,
                  ),
                ],
              ),
            ),
            if (data.nowServing != null) ...[
              const SizedBox(height: 20),
              const SectionHeader(title: 'Now serving'),
              SectionCard(
                child: Row(
                  children: [
                    const Icon(Icons.campaign_rounded, color: AppColors.accent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '${data.nowServing!.reference} at counter ${data.nowServing!.counter}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => context.push(AppRoutes.ticket(data.reference)),
              icon: const Icon(Icons.qr_code_2_rounded, size: 19),
              label: const Text('Show QR ticket'),
            ),
            const SizedBox(height: 14),
            const Center(
              child: Text(
                'This screen updates automatically.',
                style: TextStyle(color: AppColors.muted, fontSize: 12.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PositionCard extends StatelessWidget {
  const _PositionCard({required this.status});

  final QueueStatus status;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.forStatus(status.status);

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.navy, AppColors.accent],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              status.status,
              style: TextStyle(
                color: color == AppColors.muted ? Colors.white : Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 12.5,
              ),
            ),
          ),
          const SizedBox(height: 18),
          if (status.isWaiting) ...[
            const Text(
              'Your position',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 6),
            Text(
              '${status.position}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 54,
                fontWeight: FontWeight.w800,
                height: 1,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _HeroMetric(
                  label: 'People ahead',
                  value: '${status.peopleAhead}',
                  icon: Icons.groups_outlined,
                ),
                Container(width: 1, height: 34, color: Colors.white24),
                _HeroMetric(
                  label: 'Estimated wait',
                  value: status.estimatedWait,
                  icon: Icons.hourglass_bottom_rounded,
                ),
              ],
            ),
          ] else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(
                status.isBeingServed
                    ? 'You are being served at counter ${status.counter}.'
                    : 'This ticket is ${status.status.toLowerCase()}.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16.5,
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: Colors.white70, size: 19),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11.5)),
      ],
    );
  }
}
