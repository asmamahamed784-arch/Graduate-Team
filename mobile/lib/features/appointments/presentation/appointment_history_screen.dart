import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/state_views.dart';
import '../application/appointments_controller.dart';
import 'widgets/appointment_card.dart';

/// Completed, cancelled and rejected requests.
class AppointmentHistoryScreen extends ConsumerWidget {
  const AppointmentHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointments = ref.watch(appointmentsControllerProvider);
    final history = ref.watch(appointmentHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Appointment history')),
      body: appointments.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.read(appointmentsControllerProvider.notifier).refresh(),
        ),
        data: (_) => RefreshIndicator(
          onRefresh: () => ref.read(appointmentsControllerProvider.notifier).refresh(),
          child: history.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: const EmptyStateView(
                        icon: Icons.history_rounded,
                        title: 'Nothing in your history yet',
                        message:
                            'Requests you complete or cancel will be archived here.',
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  itemCount: history.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, index) =>
                      AppointmentCard(appointment: history[index]),
                ),
        ),
      ),
    );
  }
}
