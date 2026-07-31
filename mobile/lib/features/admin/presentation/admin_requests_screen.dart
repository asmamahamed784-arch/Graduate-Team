import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/admin_dashboard_controller.dart';
import 'admin_booking_helpers.dart';

class AdminRequestsScreen extends ConsumerStatefulWidget {
  const AdminRequestsScreen({super.key, this.initialFilter});

  final String? initialFilter;

  @override
  ConsumerState<AdminRequestsScreen> createState() => _AdminRequestsScreenState();
}

class _AdminRequestsScreenState extends ConsumerState<AdminRequestsScreen> {
  late String _filter;

  static const _filters = [
    ('all', 'All'),
    ('pending', 'Pending'),
    ('waiting', 'Waiting'),
    ('completed', 'Completed'),
    ('cancelled', 'Cancelled'),
  ];

  @override
  void initState() {
    super.initState();
    _filter = widget.initialFilter ?? 'all';
  }

  @override
  Widget build(BuildContext context) {
    final bookings = ref.watch(adminBookingsProvider);
    final queryFilter = GoRouterState.of(context).uri.queryParameters['filter'];
    if (queryFilter != null && queryFilter != _filter) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _filter = queryFilter);
      });
    }

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Requests')),
      body: bookings.when(
        loading: () => const LoadingView(message: 'Loading requests…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminBookingsProvider),
        ),
        data: (items) {
          final filtered = items
              .where((a) => matchesAdminBookingFilter(a, _filter))
              .toList()
            ..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(adminBookingsProvider),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 48,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _filters.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, index) {
                      final (value, label) = _filters[index];
                      final selected = _filter == value;
                      return FilterChip(
                        label: Text(label),
                        selected: selected,
                        onSelected: (_) => setState(() => _filter = value),
                        selectedColor: AppColors.primarySoft,
                        checkmarkColor: AppColors.primary,
                      );
                    },
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? LayoutBuilder(
                          builder: (context, constraints) => SingleChildScrollView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            child: SizedBox(
                              height: constraints.maxHeight,
                              child: EmptyStateView(
                                title: 'No requests found',
                                message: _filter == 'all'
                                    ? 'Booking requests will appear here.'
                                    : 'No requests match the "$_filter" filter.',
                                icon: Icons.inbox_outlined,
                              ),
                            ),
                          ),
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, index) =>
                              _RequestTile(appointment: filtered[index]),
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

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    final status = adminBookingStatus(appointment);
    return SectionCard(
      onTap: () => context.push(AppRoutes.adminBookingDetail(appointment.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  appointment.reference,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
              StatusChip(status: status, dense: true),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            appointment.citizenName.isNotEmpty
                ? appointment.citizenName
                : appointment.requestTypeLabel,
            style: const TextStyle(color: AppColors.muted, fontSize: 13),
          ),
          if (appointment.serviceName.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(appointment.serviceName, style: const TextStyle(fontSize: 12.5)),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              if (appointment.hasAppointmentSlot)
                _Meta(icon: Icons.event_outlined, text: Formatters.readableDate(appointment.date)),
              if (appointment.centerName.isNotEmpty)
                _Meta(icon: Icons.place_outlined, text: appointment.centerName),
              _Meta(icon: Icons.category_outlined, text: appointment.requestTypeLabel),
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
        Text(text, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      ],
    );
  }
}
