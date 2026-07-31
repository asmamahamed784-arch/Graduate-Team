import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/appointments_controller.dart';
import 'widgets/appointment_card.dart';

class MyAppointmentsScreen extends ConsumerWidget {
  const MyAppointmentsScreen({super.key});

  Future<void> _confirmCancel(
    BuildContext context,
    WidgetRef ref,
    Appointment appointment,
  ) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel this request?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reference ${appointment.reference} will be cancelled.'),
            const SizedBox(height: 14),
            TextField(
              controller: reasonController,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Reason (optional)'),
            ),
          ],
        ),
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
      await ref
          .read(appointmentsControllerProvider.notifier)
          .cancel(appointment.id, reason: reasonController.text);
      if (context.mounted) showAppSnackBar(context, 'Request cancelled.');
    } on ApiException catch (error) {
      if (context.mounted) showAppSnackBar(context, error.message, isError: true);
    } finally {
      reasonController.dispose();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointments = ref.watch(appointmentsControllerProvider);
    final active = ref.watch(activeAppointmentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My appointments'),
        actions: [
          IconButton(
            tooltip: 'History',
            onPressed: () => context.push(AppRoutes.history),
            icon: const Icon(Icons.history_rounded),
          ),
        ],
      ),
      body: appointments.when(
        loading: () => const LoadingView(message: 'Loading your requests'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.read(appointmentsControllerProvider.notifier).refresh(),
        ),
        data: (_) => RefreshIndicator(
          onRefresh: () => ref.read(appointmentsControllerProvider.notifier).refresh(),
          child: active.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: EmptyStateView(
                        icon: Icons.event_available_outlined,
                        title: 'No active requests',
                        message:
                            'Book a National ID service and it will show up here with its queue ticket.',
                        actionLabel: 'Browse services',
                        onAction: () => context.go(AppRoutes.services),
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  itemCount: active.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, index) => AppointmentCard(
                    appointment: active[index],
                    onCancel: () => _confirmCancel(context, ref, active[index]),
                  ),
                ),
        ),
      ),
    );
  }
}
