import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/appointments_controller.dart';
import 'appointment_detail_helpers.dart';
import 'appointment_section_screen.dart';
import 'widgets/cancel_reason_sheet.dart';
import 'widgets/request_status_timeline.dart';

class AppointmentDetailScreen extends ConsumerWidget {
  const AppointmentDetailScreen({super.key, required this.appointmentId});

  final String appointmentId;

  Future<void> _cancel(
    BuildContext context,
    WidgetRef ref,
    Appointment appointment,
  ) async {
    final reason = await showCancelReasonSheet(
      context,
      reference: appointment.reference,
    );
    if (reason == null || !context.mounted) return;

    try {
      await ref
          .read(appointmentsControllerProvider.notifier)
          .cancel(appointment.id, reason: reason);
      ref.invalidate(appointmentDetailProvider(appointmentId));
      if (context.mounted) {
        showAppSnackBar(context, 'Appointment cancelled.');
      }
    } on ApiException catch (error) {
      if (context.mounted) {
        showAppSnackBar(context, error.message, isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = ref.watch(appointmentDetailProvider(appointmentId));

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Request details')),
      body: appointment.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () =>
              ref.invalidate(appointmentDetailProvider(appointmentId)),
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
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                      ),
                      StatusChip(status: queueStatusHeadline(data)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    data.serviceName.isEmpty
                        ? data.requestTypeLabel
                        : data.serviceName,
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  if (data.status.toLowerCase() == 'completed' ||
                      data.requestStatus.toLowerCase() == 'completed') ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: const Row(
                        children: [
                          Icon(
                            Icons.check_circle_rounded,
                            color: AppColors.success,
                            size: 20,
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'This appointment is completed. Open the cards below to view full details.',
                              style: TextStyle(
                                color: Color(0xFF065F46),
                                fontWeight: FontWeight.w700,
                                fontSize: 12.5,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      FilledButton.icon(
                        onPressed: () =>
                            context.push(AppRoutes.ticket(data.reference)),
                        icon: const Icon(Icons.qr_code_2_rounded, size: 18),
                        label: const Text('QR Request'),
                      ),
                      if (data.isTrackable)
                        OutlinedButton.icon(
                          onPressed: () =>
                              context.push(AppRoutes.trackRef(data.reference)),
                          icon: const Icon(Icons.timeline_rounded, size: 18),
                          label: const Text('Track queue'),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SectionCard(child: RequestStatusTimeline(appointment: data)),
            const SizedBox(height: 18),
            const SectionHeader(title: 'Open a section'),
            const SizedBox(height: 10),
            _SectionNavCard(
              title: 'Request',
              subtitle: '${data.requestTypeLabel} · ${data.requestStatus}',
              icon: Icons.description_outlined,
              onTap: () => context.push(
                AppRoutes.appointmentSection(
                  appointmentId,
                  AppointmentSection.request.path,
                ),
              ),
            ),
            const SizedBox(height: 10),
            if (data.hasAppointmentSlot) ...[
              _SectionNavCard(
                title: 'Appointment',
                subtitle:
                    '${data.centerName} · ${data.timeSlot ?? data.date}',
                icon: Icons.event_available_rounded,
                onTap: () => context.push(
                  AppRoutes.appointmentSection(
                    appointmentId,
                    AppointmentSection.appointment.path,
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            if (data.isCancelled || data.needsResubmission) ...[
              _SectionNavCard(
                title: 'Staff feedback',
                subtitle: data.cancellationReasons.isEmpty
                    ? 'View notes and incorrect fields'
                    : data.cancellationReasons.take(3).join(' · '),
                icon: Icons.feedback_outlined,
                iconColor: AppColors.danger,
                iconBg: const Color(0xFFFEF2F2),
                onTap: () => context.push(
                  AppRoutes.appointmentSection(
                    appointmentId,
                    AppointmentSection.feedback.path,
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            if (data.details.isNotEmpty) ...[
              _SectionNavCard(
                title: 'Submitted information',
                subtitle: 'View each citizen detail on its own page',
                icon: Icons.person_outline_rounded,
                onTap: () => context.push(
                  AppRoutes.appointmentSection(
                    appointmentId,
                    AppointmentSection.submitted.path,
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            const SizedBox(height: 12),
            if (data.needsResubmission ||
                (data.isCancelled && data.hasStaffCancellationFeedback))
              PrimaryButton(
                label: 'Correct information',
                icon: Icons.edit_note_rounded,
                onPressed: () => context.push(AppRoutes.correction(data.id)),
              ),
            if (data.hasAppointmentSlot &&
                (data.isActive ||
                    data.isCancelled ||
                    data.needsResubmission)) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => context.push(AppRoutes.reschedule(data.id)),
                icon: const Icon(Icons.event_repeat_rounded, size: 19),
                label: const Text('Reschedule appointment'),
              ),
            ],
            if (data.canCancel) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => _cancel(context, ref, data),
                icon: const Icon(Icons.cancel_outlined, size: 19),
                label: const Text('Cancel appointment'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionNavCard extends StatelessWidget {
  const _SectionNavCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.iconColor = AppColors.primary,
    this.iconBg = AppColors.primarySoft,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  final Color iconColor;
  final Color iconBg;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.lightBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15.5,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w600,
                        fontSize: 12.5,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
