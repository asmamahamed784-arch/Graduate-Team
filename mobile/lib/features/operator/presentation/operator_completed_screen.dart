import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/operator_controller.dart';
import 'widgets/operator_ticket_tile.dart';

class OperatorCompletedScreen extends ConsumerWidget {
  const OperatorCompletedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(operatorDashboardProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Completed Today')),
      body: dashboard.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(operatorDashboardProvider),
        ),
        data: (data) {
          final completed = data.servedToday;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(operatorDashboardProvider);
              await ref.read(operatorDashboardProvider.future);
            },
            child: completed.isEmpty
                ? LayoutBuilder(
                    builder: (context, constraints) => SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: SizedBox(
                        height: constraints.maxHeight,
                        child: const EmptyStateView(
                          icon: Icons.check_circle_outline_rounded,
                          title: 'No completions yet',
                          message: 'Services completed today will be listed here.',
                        ),
                      ),
                    ),
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    itemCount: completed.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      if (index == 0) {
                        return SectionHeader(
                          title: 'Completed (${completed.length})',
                          actionLabel: data.centerName.isNotEmpty ? data.centerName : null,
                        );
                      }
                      return OperatorTicketTile(ticket: completed[index - 1]);
                    },
                  ),
          );
        },
      ),
    );
  }
}
