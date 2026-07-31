import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/presentation/widgets/appointment_card.dart';
import '../application/admin_dashboard_controller.dart';
import 'admin_booking_helpers.dart';

class AdminAppointmentsScreen extends ConsumerStatefulWidget {
  const AdminAppointmentsScreen({super.key, this.initialFilter});

  final String? initialFilter;

  @override
  ConsumerState<AdminAppointmentsScreen> createState() => _AdminAppointmentsScreenState();
}

class _AdminAppointmentsScreenState extends ConsumerState<AdminAppointmentsScreen> {
  final _searchController = TextEditingController();
  late String _filter;

  static const _filters = [
    ('all', 'All'),
    ('pending', 'Pending'),
    ('waiting', 'Waiting'),
    ('completed', 'Completed'),
    ('lost', 'Lost ID'),
    ('update', 'Update'),
  ];

  @override
  void initState() {
    super.initState();
    _filter = widget.initialFilter ?? 'all';
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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
      appBar: AppBar(title: const Text('Appointments')),
      body: bookings.when(
        loading: () => const LoadingView(message: 'Loading appointments…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminBookingsProvider),
        ),
        data: (items) {
          final query = _searchController.text;
          final filtered = items
              .where((a) => matchesAdminBookingFilter(a, _filter))
              .where((a) => matchesAdminSearch(a, query))
              .toList()
            ..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(adminBookingsProvider),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search reference, citizen, service…',
                      prefixIcon: const Icon(Icons.search_rounded),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.lightBorder),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.lightBorder),
                      ),
                    ),
                  ),
                ),
                SizedBox(
                  height: 48,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _filters.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, index) {
                      final (value, label) = _filters[index];
                      return FilterChip(
                        label: Text(label),
                        selected: _filter == value,
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
                                title: 'No appointments found',
                                message: query.isEmpty
                                    ? 'Try a different filter.'
                                    : 'No results for "$query".',
                                icon: Icons.event_busy_outlined,
                              ),
                            ),
                          ),
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, index) {
                            final item = filtered[index];
                            return AppointmentCard(
                              appointment: item,
                              onTap: () => context.push(
                                AppRoutes.adminBookingDetail(item.id),
                              ),
                            );
                          },
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
