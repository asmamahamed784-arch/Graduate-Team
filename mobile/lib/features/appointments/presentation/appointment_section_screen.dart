import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import 'appointment_detail_helpers.dart';
import 'widgets/request_status_timeline.dart';

enum AppointmentSection { request, appointment, feedback, submitted }

AppointmentSection? appointmentSectionFromPath(String raw) {
  switch (raw) {
    case 'request':
      return AppointmentSection.request;
    case 'appointment':
      return AppointmentSection.appointment;
    case 'feedback':
      return AppointmentSection.feedback;
    case 'submitted':
      return AppointmentSection.submitted;
    default:
      return null;
  }
}

extension AppointmentSectionX on AppointmentSection {
  String get path {
    switch (this) {
      case AppointmentSection.request:
        return 'request';
      case AppointmentSection.appointment:
        return 'appointment';
      case AppointmentSection.feedback:
        return 'feedback';
      case AppointmentSection.submitted:
        return 'submitted';
    }
  }

  String get title {
    switch (this) {
      case AppointmentSection.request:
        return 'Request';
      case AppointmentSection.appointment:
        return 'Appointment';
      case AppointmentSection.feedback:
        return 'Staff feedback';
      case AppointmentSection.submitted:
        return 'Submitted information';
    }
  }
}

class AppointmentSectionScreen extends ConsumerWidget {
  const AppointmentSectionScreen({
    super.key,
    required this.appointmentId,
    required this.section,
  });

  final String appointmentId;
  final AppointmentSection section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(appointmentDetailProvider(appointmentId));

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: Text(section.title)),
      body: async.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () =>
              ref.invalidate(appointmentDetailProvider(appointmentId)),
        ),
        data: (data) => switch (section) {
          AppointmentSection.request => _RequestSectionPage(data: data),
          AppointmentSection.appointment => _AppointmentSectionPage(data: data),
          AppointmentSection.feedback => _FeedbackSectionPage(
              data: data,
              appointmentId: appointmentId,
            ),
          AppointmentSection.submitted => _SubmittedSectionPage(
              data: data,
              appointmentId: appointmentId,
            ),
        },
      ),
    );
  }
}

class AppointmentFieldDetailScreen extends ConsumerWidget {
  const AppointmentFieldDetailScreen({
    super.key,
    required this.appointmentId,
    required this.fieldKey,
    this.fieldLabel,
  });

  final String appointmentId;
  final String fieldKey;
  final String? fieldLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(appointmentDetailProvider(appointmentId));

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: Text(
          fieldLabel ?? AppointmentFieldInfo.labelOf(fieldKey),
        ),
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () =>
              ref.invalidate(appointmentDetailProvider(appointmentId)),
        ),
        data: (data) {
          final fields = AppointmentFieldInfo.fromDetails(data.details);
          final match = fields.where((f) => f.key == fieldKey);
          final label = fieldLabel ??
              (match.isNotEmpty
                  ? match.first.label
                  : AppointmentFieldInfo.labelOf(fieldKey));
          final value = match.isNotEmpty
              ? match.first.value
              : (data.details[fieldKey]?.toString() ?? '—');

          final incorrect = data.cancellationReasons.any((reason) {
            final key = AppointmentFieldInfo.keyForReason(reason, data.details);
            return key == fieldKey ||
                reason.trim().toLowerCase() == label.toLowerCase();
          });

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                        height: 1.3,
                      ),
                    ),
                    if (incorrect) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(99),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: const Text(
                          'Marked incorrect by staff',
                          style: TextStyle(
                            color: Color(0xFFB91C1C),
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (data.needsResubmission ||
                  (data.isCancelled && data.hasStaffCancellationFeedback)) ...[
                const SizedBox(height: 18),
                PrimaryButton(
                  label: 'Correct this information',
                  icon: Icons.edit_note_rounded,
                  onPressed: () =>
                      context.push(AppRoutes.correction(data.id)),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _RequestSectionPage extends StatelessWidget {
  const _RequestSectionPage({required this.data});

  final Appointment data;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
      children: [
        const SectionHeader(title: 'Status timeline'),
        SectionCard(child: RequestStatusTimeline(appointment: data)),
        const SizedBox(height: 18),
        SectionCard(
          child: Column(
            children: [
              DetailRow(
                label: 'Type',
                value: data.requestTypeLabel,
                icon: Icons.category_outlined,
              ),
              DetailRow(
                label: 'Request status',
                value: data.requestStatus,
                icon: Icons.flag_outlined,
              ),
              DetailRow(
                label: 'Queue status',
                value: data.status,
                icon: Icons.groups_2_outlined,
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
              if (data.ticketNumber.isNotEmpty)
                DetailRow(
                  label: 'Request number',
                  value: data.ticketNumber,
                  icon: Icons.confirmation_number_outlined,
                ),
              if (data.reference.isNotEmpty)
                DetailRow(
                  label: 'Reference',
                  value: data.reference,
                  icon: Icons.tag_rounded,
                  copyable: true,
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AppointmentSectionPage extends StatelessWidget {
  const _AppointmentSectionPage({required this.data});

  final Appointment data;

  @override
  Widget build(BuildContext context) {
    if (!data.hasAppointmentSlot) {
      return const EmptyStateView(
        icon: Icons.event_busy_outlined,
        title: 'No appointment slot',
        message: 'This request does not have a booked center visit yet.',
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
      children: [
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
              if (data.district.isNotEmpty)
                DetailRow(
                  label: 'District',
                  value: data.district,
                  icon: Icons.map_outlined,
                ),
            ],
          ),
        ),
        if (data.hasAppointmentSlot &&
            (data.isActive || data.isCancelled || data.needsResubmission)) ...[
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: () => context.push(AppRoutes.reschedule(data.id)),
            icon: const Icon(Icons.event_repeat_rounded, size: 19),
            label: const Text('Reschedule appointment'),
          ),
        ],
      ],
    );
  }
}

class _FeedbackSectionPage extends StatelessWidget {
  const _FeedbackSectionPage({
    required this.data,
    required this.appointmentId,
  });

  final Appointment data;
  final String appointmentId;

  @override
  Widget build(BuildContext context) {
    final reasons = data.cancellationReasons;
    final notes = data.cancellationNotes.trim();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF2F2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'STAFF FEEDBACK',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: AppColors.danger,
                ),
              ),
              SizedBox(height: 6),
              Text(
                'Tap a field card to open it on its own page and correct it.',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const SectionHeader(title: 'Incorrect fields'),
        const SizedBox(height: 10),
        if (reasons.isEmpty)
          const SectionCard(
            child: Text(
              'Please correct your information and resubmit.',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          )
        else
          for (final reason in reasons) ...[
            _NavCard(
              title: reason,
              subtitle: 'Marked incorrect — tap to view',
              icon: Icons.error_outline_rounded,
              iconColor: AppColors.danger,
              iconBg: const Color(0xFFFEF2F2),
              onTap: () {
                final key = AppointmentFieldInfo.keyForReason(
                      reason,
                      data.details,
                    ) ??
                    Uri.encodeComponent(reason);
                context.push(
                  AppRoutes.appointmentField(appointmentId, key, label: reason),
                );
              },
            ),
            const SizedBox(height: 10),
          ],
        const SizedBox(height: 8),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Notes from admin / operator',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                notes.isEmpty ? 'No additional notes were provided.' : notes,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
        if (data.needsResubmission ||
            (data.isCancelled && data.hasStaffCancellationFeedback)) ...[
          const SizedBox(height: 18),
          PrimaryButton(
            label: 'Correct information',
            icon: Icons.edit_note_rounded,
            onPressed: () => context.push(AppRoutes.correction(data.id)),
          ),
        ],
      ],
    );
  }
}

class _SubmittedSectionPage extends StatelessWidget {
  const _SubmittedSectionPage({
    required this.data,
    required this.appointmentId,
  });

  final Appointment data;
  final String appointmentId;

  @override
  Widget build(BuildContext context) {
    final fields = AppointmentFieldInfo.fromDetails(data.details);
    if (fields.isEmpty) {
      return const EmptyStateView(
        icon: Icons.description_outlined,
        title: 'No submitted details',
        message: 'Citizen details for this request are not available.',
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
      children: [
        for (var i = 0; i < fields.length; i++) ...[
          _NavCard(
            title: fields[i].label,
            subtitle: fields[i].value,
            icon: Icons.badge_outlined,
            onTap: () => context.push(
              AppRoutes.appointmentField(
                appointmentId,
                fields[i].key,
                label: fields[i].label,
              ),
            ),
          ),
          if (i != fields.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _NavCard extends StatelessWidget {
  const _NavCard({
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
                width: 44,
                height: 44,
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
                        fontSize: 15,
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
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
