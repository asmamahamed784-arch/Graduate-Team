import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/admin_dashboard_controller.dart';
import '../data/admin_repository.dart';

final adminBookingDetailProvider = FutureProvider.autoDispose.family<Appointment, String>(
  (ref, id) => ref.watch(adminRepositoryProvider).bookingById(id),
);

/// Full admin booking management — view + update status / request / correction.
class AdminBookingDetailScreen extends ConsumerStatefulWidget {
  const AdminBookingDetailScreen({super.key, required this.bookingId});

  final String bookingId;

  @override
  ConsumerState<AdminBookingDetailScreen> createState() =>
      _AdminBookingDetailScreenState();
}

class _AdminBookingDetailScreenState extends ConsumerState<AdminBookingDetailScreen> {
  bool _busy = false;

  Future<void> _refresh() async {
    ref.invalidate(adminBookingDetailProvider(widget.bookingId));
    ref.invalidate(adminBookingsProvider);
    ref.invalidate(adminDashboardProvider);
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      await _refresh();
      if (mounted) showAppSnackBar(context, success);
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } catch (e) {
      if (mounted) showAppSnackBar(context, e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _setTicketStatus(Appointment a, String status) async {
    if (status == TicketStatus.completed || status == TicketStatus.cancelled) {
      final closed = a.status == TicketStatus.completed ||
          a.status == TicketStatus.cancelled ||
          a.requestStatus == RequestStatus.cancelled ||
          a.requestStatus == RequestStatus.rejected;
      if (closed && status == TicketStatus.completed) {
        showAppSnackBar(context, 'This booking is already closed.');
        return;
      }
      if (a.status == TicketStatus.completed && status == TicketStatus.cancelled) {
        showAppSnackBar(context, 'Completed bookings cannot be cancelled.');
        return;
      }
    }

    String? reason;
    if (status == TicketStatus.cancelled) {
      reason = await _askReason(
        title: 'Cancel booking',
        hint: 'Reason for cancellation (required)',
      );
      if (reason == null || reason.trim().isEmpty) return;
    }

    await _run(
      () => ref.read(adminRepositoryProvider).updateBookingStatus(
            a.id,
            status: status,
            reason: reason,
            cancellationReasons: reason == null ? null : [reason],
          ),
      'Ticket updated to $status.',
    );
  }

  Future<void> _setRequestStatus(Appointment a, String requestStatus) async {
    await _run(
      () => ref.read(adminRepositoryProvider).updateRequestStatus(a.id, requestStatus),
      'Request status updated to $requestStatus.',
    );
  }

  Future<void> _sendCorrection(Appointment a) async {
    final notes = await _askReason(
      title: 'Request correction',
      hint: 'What should the citizen correct?',
    );
    if (notes == null || notes.trim().isEmpty) return;
    await _run(
      () => ref.read(adminRepositoryProvider).sendCorrection(
            a.id,
            reasons: ['incorrect_information'],
            notes: notes.trim(),
          ),
      'Correction request sent to citizen.',
    );
  }

  Future<String?> _askReason({required String title, required String hint}) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: InputDecoration(hintText: hint),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Back')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  bool _isClosed(Appointment a) {
    final s = a.status.toLowerCase();
    final r = a.requestStatus.toLowerCase();
    return s == 'completed' ||
        s == 'cancelled' ||
        r == 'cancelled' ||
        r == 'rejected' ||
        r == 'completed';
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(adminBookingDetailProvider(widget.bookingId));

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text('Manage booking'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _busy ? null : _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: async.when(
        loading: () => const LoadingView(message: 'Loading booking…'),
        error: (e, _) => ErrorStateView(
          error: e,
          onRetry: _refresh,
        ),
        data: (a) {
          final closed = _isClosed(a);
          return Stack(
            children: [
              ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                children: [
                  SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                a.reference.isEmpty ? a.id : a.reference,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            StatusChip(status: a.status),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          a.citizenName.isEmpty ? 'Citizen' : a.citizenName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          a.serviceName.isEmpty ? a.requestTypeLabel : a.serviceName,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  const SectionHeader(title: 'Booking info'),
                  SectionCard(
                    child: Column(
                      children: [
                        DetailRow(
                          label: 'Request type',
                          value: a.requestTypeLabel,
                          icon: Icons.category_outlined,
                        ),
                        DetailRow(
                          label: 'Ticket status',
                          value: a.status,
                          icon: Icons.confirmation_number_outlined,
                        ),
                        DetailRow(
                          label: 'Request status',
                          value: a.requestStatus,
                          icon: Icons.flag_outlined,
                        ),
                        DetailRow(
                          label: 'Submitted',
                          value: Formatters.dateTime(a.createdAt),
                          icon: Icons.schedule_rounded,
                        ),
                        if (a.nationalIdNumber.isNotEmpty)
                          DetailRow(
                            label: 'National ID',
                            value: a.nationalIdNumber,
                            icon: Icons.badge_outlined,
                            copyable: true,
                          ),
                        if (a.queueNumber.isNotEmpty)
                          DetailRow(
                            label: 'Queue number',
                            value: a.queueNumber,
                            icon: Icons.numbers_rounded,
                          ),
                      ],
                    ),
                  ),
                  if (a.hasAppointmentSlot) ...[
                    const SizedBox(height: 18),
                    const SectionHeader(title: 'Appointment'),
                    SectionCard(
                      child: Column(
                        children: [
                          DetailRow(
                            label: 'Center',
                            value: a.centerName,
                            icon: Icons.location_city_rounded,
                          ),
                          DetailRow(
                            label: 'District',
                            value: a.district.isEmpty ? '--' : a.district,
                            icon: Icons.map_outlined,
                          ),
                          DetailRow(
                            label: 'Date',
                            value: Formatters.readableDate(a.date),
                            icon: Icons.event_outlined,
                          ),
                          DetailRow(
                            label: 'Time',
                            value: a.timeSlot ?? '--',
                            icon: Icons.access_time_rounded,
                          ),
                          DetailRow(
                            label: 'Counter',
                            value: a.counter,
                            icon: Icons.desk_outlined,
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (a.details.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    const SectionHeader(title: 'Citizen submitted data'),
                    SectionCard(child: _AdminDetailsBlock(details: a.details)),
                  ],
                  const SizedBox(height: 18),
                  const SectionHeader(title: 'Admin actions'),
                  SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Ticket status',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final s in const [
                              'Pending',
                              'Waiting',
                              'Being Served',
                              'On Hold',
                              'Approved',
                              'Completed',
                              'Rejected',
                              'Cancelled',
                            ])
                              ActionChip(
                                label: Text(s),
                                onPressed: (_busy || (closed && s != a.status))
                                    ? null
                                    : () => _setTicketStatus(a, s),
                                backgroundColor: a.status == s
                                    ? AppColors.primarySoft
                                    : Colors.white,
                              ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Request / application status',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final s in const [
                              'Pending',
                              'Under Review',
                              'Approved',
                              'In Progress',
                              'Resubmission Required',
                              'Completed',
                              'Rejected',
                              'Cancelled',
                            ])
                              ActionChip(
                                label: Text(s),
                                onPressed: _busy ? null : () => _setRequestStatus(a, s),
                                backgroundColor: a.requestStatus == s
                                    ? AppColors.primarySoft
                                    : Colors.white,
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          onPressed: _busy || closed ? null : () => _sendCorrection(a),
                          icon: const Icon(Icons.edit_note_rounded),
                          label: const Text('Send correction to citizen'),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: () => context.push(AppRoutes.ticket(a.reference)),
                          icon: const Icon(Icons.qr_code_2_rounded),
                          label: const Text('View QR ticket'),
                        ),
                        if (a.isTrackable) ...[
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: () => context.push(AppRoutes.trackRef(a.reference)),
                            icon: const Icon(Icons.timeline_rounded),
                            label: const Text('Track queue'),
                          ),
                        ],
                        const SizedBox(height: 8),
                        FilledButton.icon(
                          onPressed: _busy || a.status == TicketStatus.completed
                              ? null
                              : () => _setTicketStatus(a, TicketStatus.cancelled),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.danger,
                          ),
                          icon: const Icon(Icons.cancel_outlined),
                          label: const Text('Cancel booking'),
                        ),
                        if (a.status == TicketStatus.completed)
                          const Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Text(
                              'Completed bookings cannot be cancelled.',
                              style: TextStyle(color: AppColors.muted, fontSize: 12.5),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (_busy)
                const ColoredBox(
                  color: Color(0x66FFFFFF),
                  child: Center(child: CircularProgressIndicator()),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _AdminDetailsBlock extends StatelessWidget {
  const _AdminDetailsBlock({required this.details});

  final Map<String, dynamic> details;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    details.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.trim().isEmpty) return;
      if (value is List && value.isEmpty) return;
      if (key == 'changes' && value is List) {
        for (final change in value.whereType<Map>()) {
          rows.add(
            DetailRow(
              label: '${change['field'] ?? 'Change'}',
              value: '${change['currentValue'] ?? ''} → ${change['newValue'] ?? ''}',
            ),
          );
        }
        return;
      }
      rows.add(
        DetailRow(
          label: Formatters.titleCase(
            key.replaceAllMapped(RegExp(r'([A-Z])'), (m) => ' ${m[1]}').trim(),
          ),
          value: value is List ? value.join(', ') : value.toString(),
        ),
      );
    });
    if (rows.isEmpty) {
      return const Text('No extra details.', style: TextStyle(color: AppColors.muted));
    }
    return Column(children: rows);
  }
}
