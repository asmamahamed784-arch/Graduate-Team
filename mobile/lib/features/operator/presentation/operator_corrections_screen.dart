import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/operator_controller.dart';
import '../data/operator_repository.dart';
import '../models/operator_models.dart';
import 'widgets/operator_ticket_tile.dart';

class OperatorCorrectionsScreen extends ConsumerStatefulWidget {
  const OperatorCorrectionsScreen({super.key});

  @override
  ConsumerState<OperatorCorrectionsScreen> createState() =>
      _OperatorCorrectionsScreenState();
}

class _OperatorCorrectionsScreenState extends ConsumerState<OperatorCorrectionsScreen> {
  bool _submitting = false;

  Future<void> _sendCorrection(Appointment ticket) async {
    if (_submitting) return;

    final selected = <String>{};
    final notesController = TextEditingController();

    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Correction — ${ticket.reference}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final reason in operatorCorrectionReasonOptions)
                      FilterChip(
                        label: Text(reason, style: const TextStyle(fontSize: 12)),
                        selected: selected.contains(reason),
                        onSelected: (value) {
                          setDialogState(() {
                            if (value) {
                              selected.add(reason);
                            } else {
                              selected.remove(reason);
                            }
                          });
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  decoration: const InputDecoration(
                    labelText: 'Additional notes (required)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: selected.isEmpty || notesController.text.trim().isEmpty
                  ? null
                  : () => Navigator.pop(dialogContext, true),
              child: const Text('Send correction'),
            ),
          ],
        ),
      ),
    );

    if (submitted != true) return;

    setState(() => _submitting = true);
    try {
      await ref.read(operatorRepositoryProvider).sendCorrection(
            ticket.id,
            reasons: selected.toList(),
            notes: notesController.text.trim(),
          );
      refreshOperatorData(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Correction request sent.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } finally {
      notesController.dispose();
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(operatorDashboardProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Correction Requests')),
      body: dashboard.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(operatorDashboardProvider),
        ),
        data: (data) {
          final corrections = data.pendingCorrections;
          final candidates = data.allCenterTickets
              .where((ticket) =>
                  !operatorTicketIsCompleted(ticket) && !ticket.isCancelled)
              .toList();

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(operatorDashboardProvider);
              await ref.read(operatorDashboardProvider.future);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (corrections.isNotEmpty) ...[
                  SectionHeader(
                    title: 'Awaiting citizen resubmission (${corrections.length})',
                  ),
                  ...corrections.map(
                    (ticket) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: OperatorTicketTile(ticket: ticket),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                SectionHeader(
                  title: 'Send correction',
                ),
                if (candidates.isEmpty)
                  const EmptyStateView(
                    icon: Icons.edit_note_rounded,
                    title: 'No tickets available',
                    message: 'Active tickets will appear here when you can send corrections.',
                  )
                else
                  ...candidates.take(20).map(
                        (ticket) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: SectionCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                OperatorTicketTile(ticket: ticket),
                                const SizedBox(height: 10),
                                OutlinedButton.icon(
                                  onPressed: _submitting || operatorTicketIsCompleted(ticket)
                                      ? null
                                      : () => _sendCorrection(ticket),
                                  icon: const Icon(Icons.send_rounded, size: 18),
                                  label: const Text('Send correction request'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
              ],
            ),
          );
        },
      ),
    );
  }
}
