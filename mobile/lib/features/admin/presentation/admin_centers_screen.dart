import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/center.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/admin_dashboard_controller.dart';

class AdminCentersScreen extends ConsumerWidget {
  const AdminCentersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final centers = ref.watch(adminCentersProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Manage Centers')),
      body: centers.when(
        loading: () => const LoadingView(message: 'Loading centers…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminCentersProvider),
        ),
        data: (items) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(adminCentersProvider),
          child: items.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: const EmptyStateView(
                        title: 'No centers found',
                        message: 'Service centers configured in the system appear here.',
                        icon: Icons.location_city_outlined,
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _CenterTile(center: items[index]),
                ),
        ),
      ),
    );
  }
}

class _CenterTile extends StatelessWidget {
  const _CenterTile({required this.center});

  final CenterModel center;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(center.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              StatusChip(status: center.status, dense: true),
            ],
          ),
          const SizedBox(height: 8),
          Text(center.location, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              if (center.phone.isNotEmpty)
                _Meta(icon: Icons.phone_outlined, text: Formatters.phoneDisplay(center.phone)),
              _Meta(icon: Icons.countertops_outlined, text: '${center.counters} counters'),
              _Meta(icon: Icons.groups_outlined, text: 'Cap. ${center.capacity}'),
              if (center.hours.isNotEmpty)
                _Meta(icon: Icons.schedule_outlined, text: center.hours),
            ],
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
        Icon(icon, size: 14, color: AppColors.muted),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
      ],
    );
  }
}
