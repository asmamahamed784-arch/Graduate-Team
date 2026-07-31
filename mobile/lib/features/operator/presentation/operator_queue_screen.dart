import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/role_drawer.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/operator_controller.dart';
import 'widgets/operator_ticket_tile.dart';

class OperatorQueueScreen extends ConsumerWidget {
  const OperatorQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(operatorQueueDataProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text('Current Queue'),
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded),
          onPressed: () => ShellDrawerScope.maybeOf(context)?.openDrawer(),
        ),
      ),
      body: queue.when(
        loading: () => const LoadingView(message: 'Loading queue…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(operatorQueueDataProvider),
        ),
        data: (data) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(operatorQueueDataProvider);
            await ref.read(operatorQueueDataProvider.future);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              if (data.currentlyServing != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(title: 'Now serving'),
                        OperatorTicketTile(
                          ticket: data.currentlyServing!,
                          highlight: true,
                        ),
                        const SizedBox(height: 16),
                        SectionHeader(
                          title: 'Waiting (${data.waitingTickets.length})',
                        ),
                      ],
                    ),
                  ),
                )
              else
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: SectionHeader(
                      title: 'Waiting (${data.waitingTickets.length})',
                    ),
                  ),
                ),
              if (data.waitingTickets.isEmpty && data.onHoldTickets.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyStateView(
                    icon: Icons.people_outline_rounded,
                    title: 'Queue is empty',
                    message: data.centerName.isNotEmpty
                        ? 'No citizens waiting at ${data.centerName}.'
                        : 'No citizens waiting right now.',
                  ),
                )
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: data.waitingTickets.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, index) => OperatorTicketTile(
                      ticket: data.waitingTickets[index],
                      position: index + 1,
                    ),
                  ),
                ),
                if (data.onHoldTickets.isNotEmpty) ...[
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(16, 20, 16, 8),
                      child: SectionHeader(title: 'On hold'),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    sliver: SliverList.separated(
                      itemCount: data.onHoldTickets.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, index) => OperatorTicketTile(
                        ticket: data.onHoldTickets[index],
                      ),
                    ),
                  ),
                ] else
                  const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
