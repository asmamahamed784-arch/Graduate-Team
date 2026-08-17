import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/models/appointment.dart';
import '../../../../shared/widgets/common_widgets.dart';
import 'staff_cancellation_feedback.dart';

class AppointmentCard extends StatelessWidget {
  const AppointmentCard({
    super.key,
    required this.appointment,
    this.onCancel,
    this.onTap,
  });

  final Appointment appointment;
  final VoidCallback? onCancel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      onTap: onTap ?? () => context.push(AppRoutes.appointmentDetail(appointment.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      appointment.reference,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      appointment.serviceName.isEmpty
                          ? appointment.requestTypeLabel
                          : appointment.serviceName,
                      style: const TextStyle(color: AppColors.muted, fontSize: 12.8),
                    ),
                  ],
                ),
              ),
              StatusChip(status: appointment.status),
            ],
          ),
          if (appointment.needsResubmission || appointment.isCancelled) ...[
            const SizedBox(height: 12),
            StaffCancellationFeedback(appointment: appointment),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              if (appointment.hasAppointmentSlot)
                _InfoBit(
                  icon: Icons.event_outlined,
                  text: Formatters.readableDate(appointment.date),
                ),
              if (appointment.timeSlot != null)
                _InfoBit(icon: Icons.schedule_rounded, text: appointment.timeSlot!),
              if (appointment.centerName.isNotEmpty)
                _InfoBit(icon: Icons.place_outlined, text: appointment.centerName),
            ],
          ),
          const SizedBox(height: 14),
          if (appointment.needsResubmission ||
              (appointment.isCancelled &&
                  appointment.hasStaffCancellationFeedback)) ...[
            FilledButton.icon(
              onPressed: () =>
                  context.push(AppRoutes.correction(appointment.id)),
              icon: const Icon(Icons.edit_note_rounded, size: 18),
              label: const Text('Correct information'),
              style: FilledButton.styleFrom(minimumSize: const Size(0, 42)),
            ),
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () =>
                      context.push(AppRoutes.appointmentDetail(appointment.id)),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
                  child: const Text('Details'),
                ),
              ),
              if (appointment.isTrackable) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () =>
                        context.push(AppRoutes.trackRef(appointment.reference)),
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 42)),
                    child: const Text('Track'),
                  ),
                ),
              ],
              if (appointment.canCancel && onCancel != null) ...[
                const SizedBox(width: 6),
                IconButton(
                  onPressed: onCancel,
                  tooltip: 'Cancel request',
                  icon: const Icon(Icons.cancel_outlined, color: AppColors.danger),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoBit extends StatelessWidget {
  const _InfoBit({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: AppColors.muted),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(fontSize: 12.5)),
      ],
    );
  }
}
