import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/role_drawer.dart';
import '../../../shared/widgets/stat_card.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/data/otp_repository.dart';
import '../application/operator_controller.dart';
import '../data/operator_repository.dart';
import '../models/operator_models.dart';

class OperatorHomeScreen extends ConsumerStatefulWidget {
  const OperatorHomeScreen({super.key});

  @override
  ConsumerState<OperatorHomeScreen> createState() => _OperatorHomeScreenState();
}

class _OperatorHomeScreenState extends ConsumerState<OperatorHomeScreen> {
  bool _acting = false;

  Future<void> _refresh() async {
    ref.invalidate(operatorDashboardProvider);
    await ref.read(operatorDashboardProvider.future);
  }

  Future<void> _callNext() async {
    if (_acting) return;
    setState(() => _acting = true);
    try {
      final user = ref.read(currentUserProvider);
      await ref.read(operatorRepositoryProvider).callNext(centerId: user?.centerId);
      refreshOperatorData(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Next citizen called.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _completeTicket(Appointment ticket) async {
    if (_acting || operatorTicketIsCompleted(ticket)) return;
    setState(() => _acting = true);
    try {
      final otpRepo = ref.read(otpRepositoryProvider);
      final session = await otpRepo.request(
        purpose: OtpPurpose.completeService,
        ticketId: ticket.id,
      );
      if (!mounted) return;

      final code = await _promptOtp(context, ticket.reference);
      if (code == null || code.trim().isEmpty) return;

      final token = await otpRepo.verify(
        purpose: OtpPurpose.completeService,
        code: code.trim(),
        otpId: session.otpId,
        ticketId: ticket.id,
      );

      await ref.read(operatorRepositoryProvider).complete(ticket.id, otpToken: token);
      refreshOperatorData(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${ticket.reference} marked completed.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _cancelTicket(Appointment ticket) async {
    if (_acting || !operatorCanCancel(ticket)) return;

    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final controller = TextEditingController(
          text: 'Cancelled by center staff',
        );
        return AlertDialog(
          title: Text('Cancel ${ticket.reference}?'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Reason',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Keep'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, controller.text.trim()),
              style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
              child: const Text('Cancel ticket'),
            ),
          ],
        );
      },
    );

    if (reason == null) return;

    setState(() => _acting = true);
    try {
      await ref.read(operatorRepositoryProvider).cancel(ticket.id, reason: reason);
      refreshOperatorData(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${ticket.reference} cancelled.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _sendCorrection(Appointment ticket) async {
    if (_acting) return;

    final selected = <String>{};
    final notesController = TextEditingController();

    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Send correction — ${ticket.reference}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Select problems found:',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
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
              child: const Text('Close'),
            ),
            FilledButton(
              onPressed: selected.isEmpty || notesController.text.trim().isEmpty
                  ? null
                  : () => Navigator.pop(dialogContext, true),
              child: const Text('Send'),
            ),
          ],
        ),
      ),
    );

    if (submitted != true) return;

    setState(() => _acting = true);
    try {
      await ref.read(operatorRepositoryProvider).sendCorrection(
            ticket.id,
            reasons: selected.toList(),
            notes: notesController.text.trim(),
          );
      refreshOperatorData(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Correction request sent to citizen.')),
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
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<String?> _promptOtp(BuildContext context, String reference) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Citizen OTP'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Enter the OTP sent to the citizen for $reference.'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'OTP code',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: const Text('Verify'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(operatorDashboardProvider);
    final user = ref.watch(currentUserProvider);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      body: dashboard.when(
        loading: () => const LoadingView(message: 'Loading dashboard…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: _refresh,
        ),
        data: (data) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: _OperatorHeader(
                  centerName: data.centerName.isNotEmpty
                      ? data.centerName
                      : (user?.displayName ?? 'Operator'),
                  onMenu: () => ShellDrawerScope.maybeOf(context)?.openDrawer(),
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 24 + bottomInset + 72),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    Text(
                      'Hello, ${user?.displayName ?? 'Operator'}',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      Formatters.readableDate(DateTime.now().toIso8601String()),
                      style: const TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                    const SizedBox(height: 18),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 1.15,
                      children: [
                        StatCard(
                          label: 'Waiting Citizens',
                          value: '${data.ticketsWaitingCount}',
                          icon: Icons.people_outline_rounded,
                          color: AppColors.warning,
                        ),
                        StatCard(
                          label: 'Current Ticket',
                          value: data.currentlyServing?.reference ?? '--',
                          icon: Icons.confirmation_number_outlined,
                          color: AppColors.info,
                          caption: data.currentlyServing?.citizenName,
                        ),
                        StatCard(
                          label: 'Completed Today',
                          value: '${data.todayStats.completed}',
                          icon: Icons.check_circle_outline_rounded,
                          color: AppColors.success,
                        ),
                        StatCard(
                          label: 'Cancelled Today',
                          value: '${data.todayStats.cancelled}',
                          icon: Icons.cancel_outlined,
                          color: AppColors.danger,
                        ),
                        StatCard(
                          label: 'Pending Corrections',
                          value: '${data.pendingCorrectionsCount}',
                          icon: Icons.edit_note_rounded,
                          color: const Color(0xFFB45309),
                        ),
                        StatCard(
                          label: 'Assigned Service Center',
                          value: data.centerName.isNotEmpty ? '1' : '0',
                          icon: Icons.location_city_rounded,
                          color: AppColors.primary,
                          caption: data.centerName.isNotEmpty
                              ? data.centerName
                              : 'Not assigned',
                        ),
                      ],
                    ),
                    const SizedBox(height: 22),
                    if (data.currentlyServing != null) ...[
                      const SectionHeader(title: 'Currently serving'),
                      _CurrentTicketCard(
                        ticket: data.currentlyServing!,
                        acting: _acting,
                        onComplete: () => _completeTicket(data.currentlyServing!),
                        onCancel: () => _cancelTicket(data.currentlyServing!),
                        onCorrection: () => _sendCorrection(data.currentlyServing!),
                      ),
                      const SizedBox(height: 18),
                    ],
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _acting ? null : _callNext,
                        icon: _acting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.call_made_rounded),
                        label: const Text('Call Next'),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                          backgroundColor: AppColors.primary,
                        ),
                      ),
                    ),
                    if (data.avgServiceTime != '--') ...[
                      const SizedBox(height: 12),
                      Text(
                        'Avg service time today: ${data.avgServiceTime}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
                      ),
                    ],
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OperatorHeader extends StatelessWidget {
  const _OperatorHeader({required this.centerName, required this.onMenu});

  final String centerName;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.paddingOf(context).top + 12,
        16,
        20,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.navy, AppColors.navyDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onMenu,
            icon: const Icon(Icons.menu_rounded, color: Colors.white),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Operator Dashboard',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  centerName,
                  style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CurrentTicketCard extends StatelessWidget {
  const _CurrentTicketCard({
    required this.ticket,
    required this.acting,
    required this.onComplete,
    required this.onCancel,
    required this.onCorrection,
  });

  final Appointment ticket;
  final bool acting;
  final VoidCallback onComplete;
  final VoidCallback onCancel;
  final VoidCallback onCorrection;

  @override
  Widget build(BuildContext context) {
    final completed = operatorTicketIsCompleted(ticket);
    final canCancel = operatorCanCancel(ticket);

    return SectionCard(
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
                      ticket.reference,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ticket.citizenName.isNotEmpty
                          ? ticket.citizenName
                          : ticket.serviceName,
                      style: const TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
              StatusChip(status: ticket.status),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              if (ticket.counter != '--')
                _Meta(icon: Icons.desktop_windows_outlined, text: ticket.counter),
              if (ticket.timeSlot != null)
                _Meta(icon: Icons.schedule_rounded, text: ticket.timeSlot!),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: acting || completed ? null : onComplete,
                  icon: const Icon(Icons.check_rounded, size: 18),
                  label: const Text('Complete'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.success,
                    minimumSize: const Size.fromHeight(44),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: acting || !canCancel ? null : onCancel,
                  icon: const Icon(Icons.close_rounded, size: 18),
                  label: const Text('Cancel'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    minimumSize: const Size.fromHeight(44),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: acting || completed ? null : onCorrection,
              icon: const Icon(Icons.edit_note_rounded, size: 18),
              label: const Text('Send correction'),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppColors.muted),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
      ],
    );
  }
}
