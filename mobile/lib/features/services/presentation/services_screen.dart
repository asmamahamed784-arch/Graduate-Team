import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/service.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../data/service_repository.dart';

class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final services = ref.watch(servicesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Services')),
      body: services.when(
        loading: () => const LoadingView(message: 'Loading services'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(servicesProvider),
        ),
        data: (all) {
          final filtered = all
              .where((service) => service.isActive)
              .where(
                (service) =>
                    _query.isEmpty ||
                    service.name.toLowerCase().contains(_query) ||
                    service.description.toLowerCase().contains(_query),
              )
              .toList();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(servicesProvider),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'Search services',
                      prefixIcon: Icon(Icons.search_rounded),
                    ),
                    onChanged: (value) =>
                        setState(() => _query = value.trim().toLowerCase()),
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? EmptyStateView(
                          icon: Icons.search_off_rounded,
                          title: _query.isEmpty
                              ? 'No services available'
                              : 'No services match "$_query"',
                          message: _query.isEmpty
                              ? 'Published National ID services will appear here.'
                              : 'Try a different search term.',
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics(),
                          ),
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, index) =>
                              ServiceCard(service: filtered[index]),
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

class ServiceCard extends StatelessWidget {
  const ServiceCard({super.key, required this.service});

  final ServiceModel service;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      onTap: () => context.push(AppRoutes.serviceDetail(service.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.navy.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.assignment_outlined, color: AppColors.navy),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  service.name,
                  style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          if (service.description.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              service.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, height: 1.4),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              _MetaPill(icon: Icons.schedule_rounded, label: '${service.duration} min'),
              const SizedBox(width: 8),
              _MetaPill(icon: Icons.category_outlined, label: service.category),
              const Spacer(),
              FilledButton(
                onPressed: () => context.push(AppRoutes.book(service.id)),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(96, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                child: const Text('Book'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.muted.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.muted),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}
