import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/appointments_controller.dart';
import '../data/booking_repository.dart';

/// Reads from the cached list first, then falls back to
/// `GET /api/bookings/:refOrId` for deep links.
final _appointmentDetailProvider = FutureProvider.family<Appointment, String>(
  isAutoDispose: true,
  (ref, id) async {
    final cached = ref.watch(appointmentByIdProvider(id));
    if (cached != null) return cached;
    return ref.watch(bookingRepositoryProvider).byReference(id);
  },
);

class AppointmentDetailScreen extends ConsumerWidget {
  const AppointmentDetailScreen({super.key, required this.appointmentId});

  final String appointmentId;

  Future<void> _cancel(
    BuildContext context,
    WidgetRef ref,
    Appointment appointment,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel this request?'),
        content: Text('Reference ${appointment.reference} will be cancelled.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep it'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Cancel request'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(appointmentsControllerProvider.notifier).cancel(appointment.id);
      ref.invalidate(_appointmentDetailProvider(appointmentId));
      if (context.mounted) showAppSnackBar(context, 'Request cancelled.');
    } on ApiException catch (error) {
      if (context.mounted) showAppSnackBar(context, error.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = ref.watch(_appointmentDetailProvider(appointmentId));

    return Scaffold(
      appBar: AppBar(title: const Text('Request details')),
      body: appointment.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(_appointmentDetailProvider(appointmentId)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          data.reference,
                          style: const TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      StatusChip(status: data.status),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    data.serviceName.isEmpty
                        ? data.requestTypeLabel
                        : data.serviceName,
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => context.push(AppRoutes.ticket(data.reference)),
                          icon: const Icon(Icons.qr_code_2_rounded, size: 18),
                          label: const Text('QR ticket'),
                          style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                        ),
                      ),
                      if (data.isTrackable) ...[
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () =>
                                context.push(AppRoutes.trackRef(data.reference)),
                            icon: const Icon(Icons.timeline_rounded, size: 18),
                            label: const Text('Track'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 44),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const SectionHeader(title: 'Request'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Type',
                    value: data.requestTypeLabel,
                    icon: Icons.category_outlined,
                  ),
                  DetailRow(
                    label: 'Progress',
                    value: data.requestStatus,
                    icon: Icons.timeline_rounded,
                  ),
                  DetailRow(
                    label: 'Submitted',
                    value: Formatters.dateTime(data.createdAt),
                    icon: Icons.schedule_rounded,
                  ),
                  if (data.nationalIdNumber.isNotEmpty)
                    DetailRow(
                      label: 'National ID',
                      value: data.nationalIdNumber,
                      icon: Icons.badge_outlined,
                      copyable: true,
                    ),
                ],
              ),
            ),
            if (data.hasAppointmentSlot) ...[
              const SizedBox(height: 22),
              const SectionHeader(title: 'Appointment'),
              SectionCard(
                child: Column(
                  children: [
                    DetailRow(
                      label: 'Center',
                      value: data.centerName,
                      icon: Icons.location_city_rounded,
                    ),
                    if (data.centerAddress.isNotEmpty)
                      DetailRow(
                        label: 'Address',
                        value: data.centerAddress,
                        icon: Icons.place_outlined,
                      ),
                    DetailRow(
                      label: 'Date',
                      value: Formatters.readableDate(data.date),
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
                  ],
                ),
              ),
            ],
            if (data.details.isNotEmpty) ...[
              const SizedBox(height: 22),
              const SectionHeader(title: 'Submitted information'),
              SectionCard(child: _DetailsBlock(details: data.details)),
            ],
            if (data.canCancel) ...[
              const SizedBox(height: 26),
              OutlinedButton.icon(
                onPressed: () => _cancel(context, ref, data),
                icon: const Icon(Icons.cancel_outlined, size: 19),
                label: const Text('Cancel this request'),
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Renders the free-form `registrationDetails` / `replacementDetails` /
/// `updateDetails` JSON the backend stores per request type.
class _DetailsBlock extends StatelessWidget {
  const _DetailsBlock({required this.details});

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
          label: Formatters.titleCase(_humanize(key)),
          value: value is List ? value.join(', ') : value.toString(),
        ),
      );
    });

    if (rows.isEmpty) {
      return const Text(
        'No extra information was submitted.',
        style: TextStyle(color: AppColors.muted),
      );
    }
    return Column(children: rows);
  }

  String _humanize(String key) =>
      key.replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match[1]}').trim();
}
