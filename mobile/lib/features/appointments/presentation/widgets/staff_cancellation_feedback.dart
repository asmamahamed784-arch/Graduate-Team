import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/models/appointment.dart';

/// Citizen-facing panel for incorrect fields + notes after staff cancel.
class StaffCancellationFeedback extends StatelessWidget {
  const StaffCancellationFeedback({super.key, required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    if (!appointment.isCancelled && !appointment.needsResubmission) {
      return const SizedBox.shrink();
    }

    final reasons = appointment.cancellationReasons;
    final notes = appointment.cancellationNotes.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'STAFF FEEDBACK',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.8,
              color: AppColors.danger,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'These are the fields staff marked as incorrect, and any notes they left for you.',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          const Text(
            'Incorrect fields',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w900,
              color: AppColors.danger,
            ),
          ),
          const SizedBox(height: 8),
          if (reasons.isEmpty)
            const Text(
              'Please correct your information and resubmit.',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: reasons
                  .map(
                    (reason) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Text(
                        reason,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFB91C1C),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFECACA)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Notes from admin / operator',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: AppColors.danger,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  notes.isEmpty ? 'No additional notes were provided.' : notes,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
