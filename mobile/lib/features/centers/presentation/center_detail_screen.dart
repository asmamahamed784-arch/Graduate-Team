import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../data/center_repository.dart';

class CenterDetailScreen extends ConsumerWidget {
  const CenterDetailScreen({super.key, required this.centerId});

  final String centerId;

  Future<void> _call(BuildContext context, String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (!await launchUrl(uri) && context.mounted) {
      showAppSnackBar(context, 'Could not open the dialler.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final center = ref.watch(centerByIdProvider(centerId));

    return Scaffold(
      appBar: AppBar(title: const Text('Center details')),
      body: center.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(centerByIdProvider(centerId)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            Text(
              data.name,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            StatusChip(status: data.status),
            const SizedBox(height: 22),
            const SectionHeader(title: 'Contact and location'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Address',
                    value: data.address,
                    icon: Icons.place_outlined,
                  ),
                  DetailRow(label: 'City', value: data.city, icon: Icons.location_city),
                  DetailRow(
                    label: 'District',
                    value: data.district,
                    icon: Icons.map_outlined,
                  ),
                  DetailRow(
                    label: 'Phone',
                    value: Formatters.phoneDisplay(data.phone),
                    icon: Icons.phone_outlined,
                  ),
                ],
              ),
            ),
            if (data.phone.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => _call(context, data.phone),
                icon: const Icon(Icons.call_rounded, size: 19),
                label: const Text('Call this center'),
              ),
            ],
            const SizedBox(height: 22),
            const SectionHeader(title: 'Opening hours'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Hours',
                    value: data.hours,
                    icon: Icons.access_time_rounded,
                  ),
                  DetailRow(
                    label: 'Working days',
                    value: data.schedule.workingDays.join(', '),
                    icon: Icons.calendar_month_outlined,
                  ),
                  DetailRow(
                    label: 'Closed days',
                    value: data.schedule.closedDays.isEmpty
                        ? 'None'
                        : data.schedule.closedDays.join(', '),
                    icon: Icons.event_busy_outlined,
                  ),
                  DetailRow(
                    label: 'Slot length',
                    value: '${data.schedule.slotDuration} minutes',
                    icon: Icons.timelapse_rounded,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const SectionHeader(title: 'Capacity'),
            SectionCard(
              child: Row(
                children: [
                  Expanded(
                    child: _Metric(
                      label: 'Counters',
                      value: '${data.counters}',
                      icon: Icons.desk_outlined,
                    ),
                  ),
                  Container(width: 1, height: 42, color: AppColors.lightBorder),
                  Expanded(
                    child: _Metric(
                      label: 'Daily capacity',
                      value: '${data.capacity}',
                      icon: Icons.groups_outlined,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: AppColors.navy),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
      ],
    );
  }
}
