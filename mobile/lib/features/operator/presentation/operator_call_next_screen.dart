import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/role_drawer.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_controller.dart';
import '../application/operator_controller.dart';
import '../data/operator_repository.dart';
import 'widgets/operator_ticket_tile.dart';

class OperatorCallNextScreen extends ConsumerStatefulWidget {
  const OperatorCallNextScreen({super.key});

  @override
  ConsumerState<OperatorCallNextScreen> createState() => _OperatorCallNextScreenState();
}

class _OperatorCallNextScreenState extends ConsumerState<OperatorCallNextScreen> {
  bool _calling = false;

  Future<void> _callNext() async {
    if (_calling) return;
    setState(() => _calling = true);
    try {
      final user = ref.read(currentUserProvider);
      await ref.read(operatorRepositoryProvider).callNext(centerId: user?.centerId);
      refreshOperatorData(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Next citizen called to counter.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _calling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(operatorDashboardProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text('Call Next'),
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded),
          onPressed: () => ShellDrawerScope.maybeOf(context)?.openDrawer(),
        ),
      ),
      body: dashboard.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(operatorDashboardProvider),
        ),
        data: (data) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(operatorDashboardProvider);
            await ref.read(operatorDashboardProvider.future);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
            children: [
              if (data.currentlyServing != null) ...[
                const SectionHeader(title: 'Currently serving'),
                OperatorTicketTile(
                  ticket: data.currentlyServing!,
                  highlight: true,
                ),
                const SizedBox(height: 28),
              ],
              SectionCard(
                child: Column(
                  children: [
                    Text(
                      '${data.ticketsWaitingCount}',
                      style: const TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                    const Text(
                      'citizens waiting',
                      style: TextStyle(color: AppColors.muted, fontSize: 14),
                    ),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      height: 120,
                      child: FilledButton(
                        onPressed: _calling || data.ticketsWaitingCount == 0
                            ? null
                            : _callNext,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: _calling
                            ? const CircularProgressIndicator(color: Colors.white)
                            : const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.call_made_rounded, size: 36),
                                  SizedBox(height: 8),
                                  Text(
                                    'CALL NEXT',
                                    style: TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                    if (data.ticketsWaitingCount == 0) ...[
                      const SizedBox(height: 12),
                      const Text(
                        'No waiting tickets to call.',
                        style: TextStyle(color: AppColors.muted, fontSize: 13),
                      ),
                    ],
                  ],
                ),
              ),
              if (data.ticketsWaiting.isNotEmpty) ...[
                const SizedBox(height: 24),
                const SectionHeader(title: 'Next in queue'),
                ...data.ticketsWaiting.take(3).map(
                      (ticket) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: OperatorTicketTile(ticket: ticket),
                      ),
                    ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
