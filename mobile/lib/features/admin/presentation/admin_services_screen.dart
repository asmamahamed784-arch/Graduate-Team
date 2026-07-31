import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/service.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/admin_dashboard_controller.dart';
import '../data/admin_repository.dart';

class AdminServicesScreen extends ConsumerWidget {
  const AdminServicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final services = ref.watch(adminServicesProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text('Manage Services'),
        actions: [
          IconButton(
            tooltip: 'Add service',
            onPressed: () => _showCreateDialog(context, ref),
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ),
      body: services.when(
        loading: () => const LoadingView(message: 'Loading services…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminServicesProvider),
        ),
        data: (items) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(adminServicesProvider),
          child: items.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: EmptyStateView(
                        title: 'No services configured',
                        message: 'Add a service to make it bookable.',
                        icon: Icons.grid_view_outlined,
                        actionLabel: 'Add service',
                        onAction: () => _showCreateDialog(context, ref),
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _ServiceTile(service: items[index]),
                ),
        ),
      ),
    );
  }

  Future<void> _showCreateDialog(BuildContext context, WidgetRef ref) async {
    final nameController = TextEditingController();
    final descController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New service'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Name'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: descController,
                decoration: const InputDecoration(labelText: 'Description'),
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() != true) return;
              Navigator.pop(ctx, true);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );

    if (created != true || !context.mounted) {
      nameController.dispose();
      descController.dispose();
      return;
    }

    try {
      await ref.read(adminRepositoryProvider).createService({
        'name': nameController.text.trim(),
        'description': descController.text.trim(),
        'status': 'Active',
        'duration': 15,
      });
      ref.invalidate(adminServicesProvider);
      if (context.mounted) showAppSnackBar(context, 'Service created');
    } on ApiException catch (error) {
      if (context.mounted) showAppSnackBar(context, error.message, isError: true);
    } finally {
      nameController.dispose();
      descController.dispose();
    }
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({required this.service});

  final ServiceModel service;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(service.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              StatusChip(status: service.status, dense: true),
            ],
          ),
          if (service.description.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(service.description, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              _Meta(icon: Icons.category_outlined, text: service.category),
              _Meta(icon: Icons.timer_outlined, text: '${service.duration} min'),
              _Meta(icon: Icons.flag_outlined, text: service.priority),
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
