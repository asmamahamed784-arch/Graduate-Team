import 'package:flutter/material.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/models/appointment.dart';

class TimelineStep {
  const TimelineStep({
    required this.title,
    required this.done,
    this.active = false,
    this.subtitle,
  });

  final String title;
  final bool done;
  final bool active;
  final String? subtitle;
}

/// Visual workflow for a request (submitted → verified → appointment → review → done).
List<TimelineStep> buildRequestTimeline(Appointment appointment) {
  final rs = appointment.requestStatus.toLowerCase();
  final st = appointment.status.toLowerCase();
  final cancelled = appointment.isCancelled || rs.contains('reject');
  final completed = rs == 'completed' || st == 'completed';
  final correction = appointment.needsResubmission;
  final underReview = rs.contains('review') || rs.contains('progress') || rs == 'pending';
  final hasSlot = appointment.hasAppointmentSlot;
  final submitted = appointment.createdAt != null || appointment.reference.isNotEmpty;

  if (cancelled && !correction) {
    return [
      const TimelineStep(title: 'Application submitted', done: true),
      TimelineStep(
        title: 'Cancelled',
        done: true,
        active: true,
        subtitle: appointment.cancellationReason.trim().isEmpty
            ? null
            : appointment.cancellationReason,
      ),
    ];
  }

  if (correction) {
    return [
      const TimelineStep(title: 'Application submitted', done: true),
      const TimelineStep(title: 'Identity verified', done: true),
      const TimelineStep(
        title: 'Correction required',
        done: false,
        active: true,
        subtitle: 'Fix the highlighted fields and resubmit',
      ),
      const TimelineStep(title: 'Under review', done: false),
      const TimelineStep(title: 'Completed', done: false),
    ];
  }

  return [
    TimelineStep(title: 'Application submitted', done: submitted, active: !hasSlot && underReview),
    TimelineStep(
      title: 'Identity verified',
      done: submitted && !rs.contains('otp'),
    ),
    TimelineStep(
      title: 'Appointment confirmed',
      done: hasSlot && !cancelled,
      active: hasSlot && underReview && !completed,
    ),
    TimelineStep(
      title: 'Under review',
      done: completed || rs.contains('approved') || rs.contains('progress'),
      active: underReview && !completed,
    ),
    TimelineStep(
      title: 'Completed',
      done: completed,
      active: completed,
    ),
  ];
}

class RequestStatusTimeline extends StatelessWidget {
  const RequestStatusTimeline({super.key, required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    final steps = buildRequestTimeline(appointment);

    return Column(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          _TimelineRow(step: steps[i], isLast: i == steps.length - 1),
        ],
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.step, required this.isLast});

  final TimelineStep step;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final color = step.active
        ? AppColors.primary
        : step.done
        ? AppColors.success
        : AppColors.lightBorder;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: step.done || step.active ? color : Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: color, width: 2),
                ),
                child: step.done && !step.active
                    ? const Icon(Icons.check, size: 12, color: Colors.white)
                    : step.active
                    ? Center(
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                        ),
                      )
                    : null,
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: step.done ? AppColors.success.withValues(alpha: 0.35) : AppColors.lightBorder,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    step.title,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: step.active || step.done
                          ? AppColors.ink
                          : AppColors.muted,
                    ),
                  ),
                  if (step.subtitle != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      step.subtitle!,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Human label for queue / request statuses on detail screens.
String queueStatusHeadline(Appointment appointment) {
  if (appointment.isCancelled) return 'Cancelled';
  if (appointment.needsResubmission) return 'Correction required';
  final st = appointment.status.toLowerCase();
  if (st.contains('served') || st == 'being served') return 'Now serving';
  if (st.contains('wait')) return 'Waiting';
  if (st.contains('complete')) return 'Completed';
  if (st.contains('hold')) return 'On hold';
  if (appointment.requestStatus == RequestStatus.pending) {
    return 'Not checked in';
  }
  return appointment.status.isEmpty ? 'Pending' : appointment.status;
}
