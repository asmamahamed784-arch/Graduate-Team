import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/json_utils.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../../shared/widgets/stat_card.dart';
import '../application/admin_dashboard_controller.dart';

class AdminReportsScreen extends ConsumerWidget {
  const AdminReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(adminDashboardProvider);
    final analyticsAsync = ref.watch(adminAnalyticsProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Reports')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(adminDashboardProvider);
          ref.invalidate(adminAnalyticsProvider);
        },
        child: statsAsync.when(
          loading: () => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [
              SizedBox(height: 240, child: LoadingView(message: 'Loading reports…')),
            ],
          ),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: 320,
                child: ErrorStateView(
                  error: error,
                  onRetry: () {
                    ref.invalidate(adminDashboardProvider);
                    ref.invalidate(adminAnalyticsProvider);
                  },
                ),
              ),
            ],
          ),
          data: (dashboard) {
            final stats = dashboard.stats;
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                const SectionHeader(title: 'Key metrics'),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.05,
                  children: [
                    StatCard(
                      label: 'Total citizens',
                      value: '${stats.totalCitizens > 0 ? stats.totalCitizens : stats.totalUsers}',
                      icon: Icons.people_rounded,
                      color: AppColors.primary,
                    ),
                    StatCard(
                      label: 'Active operators',
                      value: '${stats.activeOperators}',
                      icon: Icons.badge_rounded,
                      color: AppColors.accent,
                    ),
                    StatCard(
                      label: 'Completed services',
                      value: '${stats.completedServices}',
                      icon: Icons.check_circle_outline_rounded,
                      color: AppColors.success,
                    ),
                    StatCard(
                      label: 'Cancelled',
                      value: '${stats.cancelledAppointments}',
                      icon: Icons.cancel_outlined,
                      color: AppColors.danger,
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const SectionHeader(title: 'Analytics summary'),
                analyticsAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: LoadingView(message: 'Loading analytics…'),
                  ),
                  error: (error, _) => ErrorStateView(
                    error: error,
                    onRetry: () => ref.invalidate(adminAnalyticsProvider),
                  ),
                  data: (analytics) => _AnalyticsSummary(data: analytics),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AnalyticsSummary extends StatelessWidget {
  const _AnalyticsSummary({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final entries = _flattenAnalytics(data);
    if (entries.isEmpty) {
      return const SectionCard(
        child: Text(
          'No analytics data available yet.',
          style: TextStyle(color: AppColors.muted),
        ),
      );
    }

    return SectionCard(
      child: Column(
        children: [
          for (var i = 0; i < entries.length; i++) ...[
            if (i > 0) const Divider(height: 20),
            Row(
              children: [
                Expanded(
                  child: Text(
                    entries[i].key,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                Text(
                  entries[i].value,
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  List<MapEntry<String, String>> _flattenAnalytics(Map<String, dynamic> root) {
    final rows = <MapEntry<String, String>>[];

    void walk(String prefix, dynamic value) {
      if (value is Map<String, dynamic>) {
        value.forEach((key, child) {
          final label = prefix.isEmpty ? _labelize(key) : '$prefix • ${_labelize(key)}';
          walk(label, child);
        });
        return;
      }
      if (value is List) {
        rows.add(MapEntry(prefix.isEmpty ? 'Items' : prefix, '${value.length}'));
        return;
      }
      if (value == null) return;
      rows.add(MapEntry(prefix.isEmpty ? 'Value' : prefix, _formatValue(value)));
    }

    walk('', root);
    return rows.take(12).toList();
  }

  String _labelize(String key) =>
      key.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}').replaceAll('_', ' ');

  String _formatValue(dynamic value) {
    if (value is num) return value.toString();
    if (value is bool) return value ? 'Yes' : 'No';
    return Json.str(value);
  }
}
