import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/admin_dashboard_controller.dart';
import '../models/admin_models.dart';

class AdminActivityScreen extends ConsumerWidget {
  const AdminActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activities = ref.watch(adminActivitiesProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Activity Logs')),
      body: activities.when(
        loading: () => const LoadingView(message: 'Loading activity…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminActivitiesProvider),
        ),
        data: (items) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(adminActivitiesProvider),
          child: items.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: const EmptyStateView(
                        title: 'No activity yet',
                        message: 'System events and admin actions will be logged here.',
                        icon: Icons.history_rounded,
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _ActivityTile(row: items[index]),
                ),
        ),
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.row});

  final AdminActivityRow row;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.history_rounded, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.action.isNotEmpty ? row.action : 'Activity',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                if (row.actor.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(row.actor, style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
                ],
                if (row.details.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(row.details, style: const TextStyle(fontSize: 13, height: 1.35)),
                ],
                if (row.createdAt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    Formatters.dateTime(row.createdAt),
                    style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
