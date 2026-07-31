import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../data/service_repository.dart';

class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({super.key, required this.serviceId});

  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = ref.watch(serviceByIdProvider(serviceId));

    return Scaffold(
      appBar: AppBar(title: const Text('Service details')),
      body: service.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(serviceByIdProvider(serviceId)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            Text(
              data.name,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                StatusChip(status: data.status),
                Chip(
                  avatar: const Icon(Icons.schedule_rounded, size: 15),
                  label: Text('${data.duration} minutes'),
                ),
                Chip(
                  avatar: const Icon(Icons.category_outlined, size: 15),
                  label: Text(data.category),
                ),
              ],
            ),
            if (data.description.trim().isNotEmpty) ...[
              const SizedBox(height: 20),
              const SectionHeader(title: 'About this service'),
              SectionCard(
                child: Text(data.description, style: const TextStyle(height: 1.5)),
              ),
            ],
            if (data.requirements.isNotEmpty) ...[
              const SizedBox(height: 22),
              const SectionHeader(title: 'What to bring'),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: data.requirements
                      .map(
                        (requirement) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.check_circle_outline_rounded,
                                  size: 18, color: AppColors.success),
                              const SizedBox(width: 10),
                              Expanded(child: Text(requirement)),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
            const SizedBox(height: 22),
            SectionCard(
              child: Row(
                children: [
                  const Icon(Icons.sms_outlined, color: AppColors.accent),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'You will receive an SMS code to confirm this request before it is submitted.',
                      style: TextStyle(color: AppColors.muted, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 26),
            PrimaryButton(
              label: data.requestType == RequestTypes.updateInformation
                  ? 'Start request'
                  : 'Book appointment',
              icon: Icons.event_available_rounded,
              onPressed: () => context.push(AppRoutes.book(data.id)),
            ),
          ],
        ),
      ),
    );
  }
}
