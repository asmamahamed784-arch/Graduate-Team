import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/center.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../data/center_repository.dart';

class CentersScreen extends ConsumerStatefulWidget {
  const CentersScreen({super.key});

  @override
  ConsumerState<CentersScreen> createState() => _CentersScreenState();
}

class _CentersScreenState extends ConsumerState<CentersScreen> {
  String? _district;

  @override
  Widget build(BuildContext context) {
    final centers = ref.watch(centersProvider);
    final districts = ref.watch(centerDistrictsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Service centers')),
      body: centers.when(
        loading: () => const LoadingView(message: 'Loading centers'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(centersProvider),
        ),
        data: (all) {
          final filtered = all
              .where((center) => _district == null || center.district == _district)
              .toList();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(centersProvider),
            child: Column(
              children: [
                if (districts.isNotEmpty)
                  SizedBox(
                    height: 56,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      children: [
                        _DistrictChip(
                          label: 'All districts',
                          selected: _district == null,
                          onTap: () => setState(() => _district = null),
                        ),
                        ...districts.map(
                          (district) => _DistrictChip(
                            label: district,
                            selected: _district == district,
                            onTap: () => setState(() => _district = district),
                          ),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: filtered.isEmpty
                      ? const EmptyStateView(
                          icon: Icons.location_off_outlined,
                          title: 'No centers found',
                          message: 'There are no service centers in this district yet.',
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, index) => CenterCard(center: filtered[index]),
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

class _DistrictChip extends StatelessWidget {
  const _DistrictChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
      ),
    );
  }
}

class CenterCard extends StatelessWidget {
  const CenterCard({super.key, required this.center});

  final CenterModel center;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      onTap: () => context.push(AppRoutes.centerDetail(center.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  center.name,
                  style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
                ),
              ),
              StatusChip(status: center.status, dense: true),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.place_outlined, size: 17, color: AppColors.muted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  center.location,
                  style: const TextStyle(color: AppColors.muted, height: 1.4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.access_time_rounded, size: 17, color: AppColors.muted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  center.hours.isEmpty ? 'Hours not published' : center.hours,
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ],
      ),
    );
  }
}
