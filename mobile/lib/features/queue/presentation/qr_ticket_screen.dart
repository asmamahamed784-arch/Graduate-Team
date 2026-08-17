import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../application/queue_controller.dart';

/// QR ticket shown after booking — appointment number, queue number, QR, details.
class QrTicketScreen extends ConsumerWidget {
  const QrTicketScreen({super.key, required this.reference});

  final String reference;

  Future<void> _shareTicket(BuildContext context, Uint8List bytes) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/nqs-ticket-$reference.png');
    await file.writeAsBytes(bytes);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path)],
        text: 'NQS National ID request $reference',
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final qr = ref.watch(ticketQrProvider(reference));
    final appointment = ref.watch(appointmentByIdProvider(reference));
    final appointmentNumber = appointment?.ticketNumber.isNotEmpty == true
        ? appointment!.ticketNumber
        : reference;
    final queueNumber = appointment?.queueNumber.isNotEmpty == true
        ? appointment!.queueNumber
        : (appointment?.counter ?? '--');

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text('QR Request'),
        actions: [
          IconButton(
            tooltip: 'Copy reference',
            onPressed: () {
              Clipboard.setData(ClipboardData(text: reference));
              showAppSnackBar(context, 'Reference copied.');
            },
            icon: const Icon(Icons.copy_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
        children: [
          SectionCard(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 26),
            child: Column(
              children: [
                const Text(
                  'NQS National ID',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Present this code at the service center',
                  style: TextStyle(color: AppColors.muted, fontSize: 12.5),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _MetaChip(label: 'Appointment', value: appointmentNumber),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MetaChip(label: 'Queue No.', value: queueNumber),
                    ),
                  ],
                ),
                const SizedBox(height: 22),
                qr.when(
                  loading: () => const SizedBox(
                    height: 220,
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
                  ),
                  error: (error, _) => SizedBox(
                    height: 220,
                    child: ErrorStateView(
                      error: error,
                      onRetry: () => ref.invalidate(ticketQrProvider(reference)),
                    ),
                  ),
                  data: (bytes) => bytes == null
                      ? const SizedBox(
                          height: 220,
                          child: Center(
                            child: Text(
                              'QR code unavailable.',
                              style: TextStyle(color: AppColors.muted),
                            ),
                          ),
                        )
                      : Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.lightBorder),
                          ),
                          child: Image.memory(bytes, height: 220, width: 220),
                        ),
                ),
              ],
            ),
          ),
          if (appointment != null) ...[
            const SizedBox(height: 22),
            const SectionHeader(title: 'Appointment details'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Service',
                    value: appointment.serviceName.isEmpty
                        ? appointment.requestTypeLabel
                        : appointment.serviceName,
                    icon: Icons.assignment_outlined,
                  ),
                  DetailRow(
                    label: 'Center',
                    value: appointment.centerName,
                    icon: Icons.location_city_rounded,
                  ),
                  DetailRow(
                    label: 'Date',
                    value: Formatters.readableDate(appointment.date),
                    icon: Icons.event_outlined,
                  ),
                  DetailRow(
                    label: 'Time',
                    value: appointment.timeSlot ?? '--',
                    icon: Icons.schedule_rounded,
                  ),
                  DetailRow(
                    label: 'Status',
                    value: appointment.requestStatus.isNotEmpty
                        ? appointment.requestStatus
                        : appointment.status,
                    icon: Icons.flag_outlined,
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
          qr.maybeWhen(
            data: (bytes) => bytes == null
                ? const SizedBox.shrink()
                : FilledButton.icon(
                    onPressed: () => _shareTicket(context, bytes),
                    icon: const Icon(Icons.download_rounded),
                    label: const Text('Download / Share request'),
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => context.push(AppRoutes.trackRef(reference)),
            icon: const Icon(Icons.timeline_rounded),
            label: const Text('Track queue'),
          ),
          if (appointment?.canCancel == true) ...[
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => context.push(AppRoutes.appointmentDetail(appointment!.id)),
              child: const Text('Cancel appointment'),
            ),
          ],
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: appointment == null
                ? null
                : () => context.push(AppRoutes.appointmentDetail(appointment.id)),
            icon: const Icon(Icons.info_outline_rounded),
            label: const Text('View appointment details'),
          ),
          const SizedBox(height: 20),
          const Center(
            child: Text(
              'Present this QR code at the service center.\nKeep brightness up so it scans quickly.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
        ],
      ),
    );
  }
}
