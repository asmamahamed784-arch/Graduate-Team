import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/models/appointment.dart';
import '../../../../shared/widgets/common_widgets.dart';

class OperatorTicketTile extends StatelessWidget {
  const OperatorTicketTile({
    super.key,
    required this.ticket,
    this.position,
    this.highlight = false,
  });

  final Appointment ticket;
  final int? position;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          if (position != null)
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: highlight
                    ? AppColors.success.withValues(alpha: 0.15)
                    : AppColors.primarySoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '$position',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: highlight ? AppColors.success : AppColors.primary,
                ),
              ),
            )
          else if (highlight)
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.phone_in_talk_rounded, color: AppColors.success),
            ),
          if (position != null || highlight) const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ticket.reference,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
                const SizedBox(height: 3),
                Text(
                  ticket.citizenName.isNotEmpty
                      ? ticket.citizenName
                      : ticket.serviceName,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
                ),
                if (ticket.hasAppointmentSlot) ...[
                  const SizedBox(height: 6),
                  Text(
                    '${Formatters.readableDate(ticket.date)}${ticket.timeSlot != null ? ' · ${ticket.timeSlot}' : ''}',
                    style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
                  ),
                ],
              ],
            ),
          ),
          StatusChip(status: ticket.status, dense: true),
        ],
      ),
    );
  }
}
