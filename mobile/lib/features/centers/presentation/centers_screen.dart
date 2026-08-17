import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/center.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/nqs_page_header.dart';
import '../../../shared/widgets/state_views.dart';
import '../../home/application/protected_action.dart';
import '../../home/presentation/home_shell.dart';
import '../../notifications/application/notifications_controller.dart';
import '../data/center_repository.dart';

/// Citizen Service Centers list — matches the approved mockup.
/// File: `mobile/lib/features/centers/presentation/centers_screen.dart`
/// Route: `/centers` (inside HomeShell so drawer + bottom nav stay visible).
class CentersScreen extends ConsumerStatefulWidget {
  const CentersScreen({super.key});

  @override
  ConsumerState<CentersScreen> createState() => _CentersScreenState();
}

class _CentersScreenState extends ConsumerState<CentersScreen> {
  String _query = '';
  String? _district;
  bool _openOnly = false;

  @override
  Widget build(BuildContext context) {
    final centers = ref.watch(centersProvider);
    final districts = ref.watch(centerDistrictsProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    return ColoredBox(
      color: AppColors.lightBackground,
      child: centers.when(
        loading: () => const LoadingView(message: 'Loading centers'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(centersProvider),
        ),
        data: (all) {
          final filtered = all.where((center) {
            if (_openOnly && center.operationalStatus != 'Open') return false;
            if (_district != null &&
                center.district != _district &&
                center.name != _district) {
              return false;
            }
            if (_query.isEmpty) return true;
            final q = _query.toLowerCase();
            return center.name.toLowerCase().contains(q) ||
                center.district.toLowerCase().contains(q) ||
                center.address.toLowerCase().contains(q) ||
                center.city.toLowerCase().contains(q);
          }).toList();

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(centersProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: tabListPadding(context),
              children: [
                NqsPageHeader(
                  icon: Icons.location_city_rounded,
                  iconColor: AppColors.success,
                  title: 'Centers',
                  subtitle: 'Find service centers',
                  onMenu: () => HomeShellScope.maybeOf(context)?.openDrawer(),
                  bell: NqsHeaderBell(
                    unread: unread,
                    onTap: () {
                      if (!ensureSignedIn(
                        context,
                        ref,
                        ProtectedAction.notifications,
                      )) {
                        return;
                      }
                      context.go(AppRoutes.notifications);
                    },
                  ),
                ),
                const SizedBox(height: 14),
                _SearchRow(
                  onChanged: (value) =>
                      setState(() => _query = value.trim().toLowerCase()),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 40,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _DistrictChip(
                        label: 'All',
                        selected: _district == null && !_openOnly,
                        onTap: () => setState(() {
                          _district = null;
                          _openOnly = false;
                        }),
                      ),
                      _DistrictChip(
                        label: 'Open Now',
                        icon: Icons.schedule_rounded,
                        selected: _openOnly,
                        onTap: () => setState(() => _openOnly = !_openOnly),
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
                const SizedBox(height: 14),
                _SummaryStatsRow(centers: all),
                const SizedBox(height: 16),
                if (filtered.isEmpty)
                  const EmptyStateView(
                    icon: Icons.location_off_outlined,
                    title: 'No centers found',
                    message: 'Try another search or district filter.',
                  )
                else
                  _CentersTable(centers: filtered),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SearchRow extends StatelessWidget {
  const _SearchRow({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            onChanged: onChanged,
            style: const TextStyle(
              color: AppColors.ink,
              fontWeight: FontWeight.w600,
              fontSize: 13.5,
            ),
            decoration: InputDecoration(
              hintText: 'Search by center name, district or area...',
              hintStyle: TextStyle(
                color: AppColors.muted.withValues(alpha: 0.9),
                fontWeight: FontWeight.w500,
                fontSize: 13,
              ),
              prefixIcon: const Icon(
                Icons.search_rounded,
                color: AppColors.muted,
              ),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.lightBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.lightBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: AppColors.primary,
                  width: 1.4,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: () {},
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.lightBorder),
              ),
              child: const Icon(Icons.tune_rounded, color: AppColors.primary),
            ),
          ),
        ),
      ],
    );
  }
}

class _DistrictChip extends StatelessWidget {
  const _DistrictChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: selected ? AppColors.primary : Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: selected ? AppColors.primary : AppColors.lightBorder,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (selected) ...[
                  Icon(
                    icon ?? Icons.check_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 5),
                ] else if (icon != null) ...[
                  Icon(icon, size: 16, color: AppColors.muted),
                  const SizedBox(width: 5),
                ],
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? Colors.white : AppColors.ink,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryStatsRow extends StatelessWidget {
  const _SummaryStatsRow({required this.centers});

  final List<CenterModel> centers;

  String get _hoursRange {
    if (centers.isEmpty) return '—';
    final first = centers.first.hoursLabel
        .replaceAll('–', '-')
        .replaceAll('—', '-')
        .trim();
    return first.isEmpty ? '08:00 - 16:00' : first;
  }

  String get _avgWait {
    if (centers.isEmpty) return '~0 min';
    var total = 0;
    for (final c in centers) {
      if (c.estimatedWaitMinutes > 0) {
        total += c.estimatedWaitMinutes;
      } else if (c.displayQueueSize > 0) {
        total += c.displayQueueSize * c.schedule.slotDuration;
      } else {
        total += c.schedule.slotDuration;
      }
    }
    return '~${(total / centers.length).round()} min';
  }

  @override
  Widget build(BuildContext context) {
    final totalCounters = centers.fold<int>(
      0,
      (sum, c) => sum + (c.counters > 0 ? c.counters : 0),
    );

    return Row(
      children: [
        Expanded(
          child: _SummaryCard(
            icon: Icons.apartment_rounded,
            iconColor: AppColors.primary,
            iconBg: AppColors.primarySoft,
            value: '${centers.length}',
            label: 'Total Centers',
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _SummaryCard(
            icon: Icons.groups_rounded,
            iconColor: AppColors.success,
            iconBg: const Color(0xFFE8F8EF),
            value: '$totalCounters',
            label: 'Counters',
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _SummaryCard(
            icon: Icons.schedule_rounded,
            iconColor: const Color(0xFFD97706),
            iconBg: const Color(0xFFFFF4E5),
            value: _hoursRange,
            label: 'Working Hours',
            valueSize: 11,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _SummaryCard(
            icon: Icons.autorenew_rounded,
            iconColor: const Color(0xFF7C3AED),
            iconBg: const Color(0xFFF3E8FF),
            value: _avgWait,
            label: 'Avg. Wait Time',
            valueSize: 12,
          ),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.value,
    required this.label,
    this.valueSize = 16,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String value;
  final String label;
  final double valueSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 12, 8, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.ink,
              fontWeight: FontWeight.w800,
              fontSize: valueSize,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.muted,
              fontWeight: FontWeight.w600,
              fontSize: 9.5,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _CentersTable extends StatelessWidget {
  const _CentersTable({required this.centers});

  final List<CenterModel> centers;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.lightBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowHeight: 42,
          dataRowMinHeight: 72,
          dataRowMaxHeight: 88,
          horizontalMargin: 12,
          columnSpacing: 18,
          headingTextStyle: const TextStyle(
            color: AppColors.muted,
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
          dataTextStyle: const TextStyle(
            color: AppColors.ink,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
          columns: const [
            DataColumn(label: Text('Center')),
            DataColumn(label: Text('Status')),
            DataColumn(label: Text('Counters'), numeric: true),
            DataColumn(label: Text('Queue'), numeric: true),
            DataColumn(label: Text('Wait')),
            DataColumn(label: Text('Actions')),
          ],
          rows: [
            for (final center in centers)
              DataRow(
                cells: [
                  DataCell(_CenterNameCell(center: center)),
                  DataCell(_StatusPill(status: center.operationalStatus)),
                  DataCell(
                    Text('${center.counters > 0 ? center.counters : 0}'),
                  ),
                  DataCell(Text('${center.displayQueueSize}')),
                  DataCell(Text(_waitLabel(center))),
                  DataCell(_CenterActions(center: center)),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _CenterNameCell extends StatelessWidget {
  const _CenterNameCell({required this.center});

  final CenterModel center;

  @override
  Widget build(BuildContext context) {
    final location = [
      if (center.district.trim().isNotEmpty) center.district,
      if (center.address.trim().isNotEmpty) center.address,
    ].join(' - ');

    return SizedBox(
      width: 190,
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.apartment_rounded,
              color: AppColors.primary,
              size: 19,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  center.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  location.ifEmpty('Location not provided'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  center.hoursLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  Color _statusColor() {
    switch (status) {
      case 'Open':
        return AppColors.success;
      case 'Busy':
        return AppColors.warning;
      default:
        return AppColors.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _statusColor();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _CenterActions extends StatelessWidget {
  const _CenterActions({required this.center});

  final CenterModel center;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 100,
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.push(AppRoutes.centerDetail(center.id)),
            icon: const Icon(Icons.visibility_outlined),
            color: AppColors.primary,
            tooltip: 'View Details',
            visualDensity: VisualDensity.compact,
          ),
          IconButton(
            onPressed: () {
              showAppSnackBar(
                context,
                '${center.name} selected. Continue from Services to book.',
              );
              context.go(AppRoutes.services);
            },
            icon: const Icon(Icons.check_circle_outline_rounded),
            color: AppColors.success,
            tooltip: 'Select Center',
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}

String _waitLabel(CenterModel center) {
  final raw = center.displayEstimatedWait.trim();
  if (raw.startsWith('~')) return raw;
  return '~$raw';
}

class CenterServiceCard extends StatelessWidget {
  const CenterServiceCard({super.key, required this.center});

  final CenterModel center;

  Color _statusColor(String status) {
    switch (status) {
      case 'Open':
        return AppColors.success;
      case 'Busy':
        return AppColors.warning;
      default:
        return AppColors.danger;
    }
  }

  String _waitLabel() {
    final raw = center.displayEstimatedWait.trim();
    if (raw.startsWith('~')) return raw;
    return '~$raw';
  }

  @override
  Widget build(BuildContext context) {
    final opStatus = center.operationalStatus;
    final statusColor = _statusColor(opStatus);
    final location = [
      if (center.district.trim().isNotEmpty) center.district,
      if (center.address.trim().isNotEmpty) center.address,
    ].join(' • ');

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.apartment_rounded,
                  color: AppColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      center.name,
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _IconLine(
                      icon: Icons.location_on_outlined,
                      text: location.ifEmpty('Location not provided'),
                    ),
                    const SizedBox(height: 4),
                    _IconLine(
                      icon: Icons.access_time_rounded,
                      text: center.hoursLabel,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  opStatus,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 11.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final service in center.displayServices.take(3))
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    service,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _Metric(
                    icon: Icons.desk_rounded,
                    label: 'Counters',
                    value: '${center.counters > 0 ? center.counters : 0}',
                  ),
                ),
                Container(width: 1, height: 36, color: AppColors.lightBorder),
                Expanded(
                  child: _Metric(
                    icon: Icons.groups_rounded,
                    label: 'Queue Size',
                    value: '${center.displayQueueSize}',
                  ),
                ),
                Container(width: 1, height: 36, color: AppColors.lightBorder),
                Expanded(
                  child: _Metric(
                    icon: Icons.schedule_rounded,
                    label: 'Est. Wait Time',
                    value: _waitLabel(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () =>
                      context.push(AppRoutes.centerDetail(center.id)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(
                      color: AppColors.primary,
                      width: 1.4,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'View Details',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    showAppSnackBar(
                      context,
                      '${center.name} selected. Continue from Services to book.',
                    );
                    context.go(AppRoutes.services);
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Select Center',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      SizedBox(width: 4),
                      Icon(Icons.chevron_right_rounded, size: 20),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IconLine extends StatelessWidget {
  const _IconLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: AppColors.muted),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: AppColors.muted,
              height: 1.3,
              fontWeight: FontWeight.w600,
              fontSize: 12.5,
            ),
          ),
        ),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 17, color: AppColors.muted),
        const SizedBox(height: 3),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 10.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.ink,
            fontWeight: FontWeight.w800,
            fontSize: 14.5,
          ),
        ),
      ],
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
}
