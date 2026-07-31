import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

/// Confirmation shown right after `POST /api/bookings` succeeds, with the
/// server-generated QR for the new ticket reference.
class BookingSuccessScreen extends ConsumerWidget {
  const BookingSuccessScreen({super.key, required this.args});

  final BookingSuccessArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointment = args.appointment;
    final qr = ref.watch(ticketQrProvider(appointment.reference));

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(AppRoutes.appointments);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Request submitted'),
          automaticallyImplyLeading: false,
          actions: [
            IconButton(
              onPressed: () => context.go(AppRoutes.appointments),
              icon: const Icon(Icons.close_rounded),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
          children: [
            const Center(
              child: CircleAvatar(
                radius: 36,
                backgroundColor: AppColors.success,
                child: Icon(Icons.check_rounded, color: Colors.white, size: 38),
              ),
            ),
            const SizedBox(height: 20),
            const Center(
              child: Text(
                'Your request was submitted',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 8),
            const Center(
              child: Text(
                'Keep this reference — you will need it at the center.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted),
              ),
            ),
            const SizedBox(height: 24),
            SectionCard(
              child: Column(
                children: [
                  Text(
                    appointment.reference,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  qr.when(
                    loading: () => const SizedBox(
                      height: 180,
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
                    ),
                    error: (_, __) => const SizedBox(
                      height: 60,
                      child: Center(
                        child: Text(
                          'The QR code could not be generated right now.',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                    ),
                    data: (bytes) => bytes == null
                        ? const SizedBox.shrink()
                        : Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Image.memory(bytes, height: 180, width: 180),
                          ),
                  ),
                  const SizedBox(height: 18),
                  const Divider(),
                  const SizedBox(height: 8),
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
                ],
              ),
            ),
            const SizedBox(height: 26),
            PrimaryButton(
              label: 'View my appointments',
              icon: Icons.event_note_rounded,
              onPressed: () => context.go(AppRoutes.appointments),
            ),
            const SizedBox(height: 12),
            if (appointment.isTrackable)
              OutlinedButton.icon(
                onPressed: () {
                  context.go(AppRoutes.appointments);
                  context.push(AppRoutes.trackRef(appointment.reference));
                },
                icon: const Icon(Icons.timeline_rounded, size: 19),
                label: const Text('Track my place in the queue'),
              ),
          ],
        ),
      ),
    );
  }
}
