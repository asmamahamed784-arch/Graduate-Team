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
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../queue/application/queue_controller.dart';

class BookingSuccessArgs {
  const BookingSuccessArgs({required this.appointment});

  final Appointment appointment;
}

class BookingSuccessScreen extends ConsumerWidget {
  const BookingSuccessScreen({super.key, required this.args});

  final BookingSuccessArgs args;

  Future<void> _shareQr(BuildContext context, Uint8List bytes, String ref) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/nqs-ticket-$ref.png');
    await file.writeAsBytes(bytes);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path)],
        text: 'NQS National ID appointment $ref',
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = args.appointment;
    final qr = ref.watch(ticketQrProvider(appointment.reference));
    final queueNo = appointment.queueNumber.isNotEmpty
        ? appointment.queueNumber
        : appointment.ticketNumber;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(AppRoutes.home);
      },
      child: Scaffold(
        backgroundColor: AppColors.lightBackground,
        appBar: AppBar(
          title: const Text('Appointment confirmed'),
          automaticallyImplyLeading: false,
          actions: [
            IconButton(
              onPressed: () => context.go(AppRoutes.home),
              icon: const Icon(Icons.close_rounded),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
          children: [
            Center(
              child: Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.success,
                  size: 54,
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Appointment confirmed',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your request was submitted. Present the QR Request at the center.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, height: 1.4),
            ),
            const SizedBox(height: 22),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Appointment number',
                    value: appointment.reference,
                    copyable: true,
                  ),
                  if (queueNo.isNotEmpty)
                    DetailRow(label: 'Queue Number', value: queueNo),
                  DetailRow(
                    label: 'Service',
                    value: appointment.serviceName.isEmpty
                        ? appointment.requestTypeLabel
                        : appointment.serviceName,
                  ),
                  if (appointment.centerName.isNotEmpty)
                    DetailRow(label: 'Center', value: appointment.centerName),
                  if (appointment.hasAppointmentSlot)
                    DetailRow(
                      label: 'Date',
                      value: Formatters.readableDate(appointment.date),
                    ),
                  if (appointment.timeSlot != null)
                    DetailRow(label: 'Time', value: appointment.timeSlot!),
                  DetailRow(label: 'Status', value: appointment.status),
                  const SizedBox(height: 12),
                  qr.when(
                    loading: () => const SizedBox(
                      height: 160,
                      child: Center(
                        child: CircularProgressIndicator(strokeWidth: 2.4),
                      ),
                    ),
                    error: (_, __) => TextButton(
                      onPressed: () =>
                          ref.invalidate(ticketQrProvider(appointment.reference)),
                      child: const Text('Retry QR code'),
                    ),
                    data: (bytes) => bytes == null
                        ? const SizedBox.shrink()
                        : Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.lightBorder),
                            ),
                            child: Image.memory(bytes, height: 170, width: 170),
                          ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'View digital request',
              icon: Icons.qr_code_2_rounded,
              onPressed: () =>
                  context.push(AppRoutes.ticket(appointment.reference)),
            ),
            const SizedBox(height: 10),
            PrimaryButton(
              label: 'View appointment',
              icon: Icons.event_note_rounded,
              onPressed: () =>
                  context.go(AppRoutes.appointmentDetail(appointment.id)),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: appointment.reference));
                showAppSnackBar(context, 'Reference copied.');
              },
              icon: const Icon(Icons.copy_rounded, size: 18),
              label: const Text('Copy appointment number'),
            ),
            const SizedBox(height: 10),
            qr.maybeWhen(
              data: (bytes) => bytes == null
                  ? const SizedBox.shrink()
                  : OutlinedButton.icon(
                      onPressed: () =>
                          _shareQr(context, bytes, appointment.reference),
                      icon: const Icon(Icons.download_rounded, size: 18),
                      label: const Text('Download / Share request'),
                    ),
              orElse: () => const SizedBox.shrink(),
            ),
            if (appointment.isTrackable) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () =>
                    context.push(AppRoutes.trackRef(appointment.reference)),
                icon: const Icon(Icons.timeline_rounded, size: 18),
                label: const Text('Track queue'),
              ),
            ],
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => context.go(AppRoutes.home),
              child: const Text('Back to Home'),
            ),
          ],
        ),
      ),
    );
  }
}
