import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/admin_dashboard_controller.dart';
import '../data/admin_repository.dart';
import '../models/admin_models.dart';

class AdminUsersScreen extends ConsumerWidget {
  const AdminUsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final users = ref.watch(adminUsersProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('User Management')),
      body: users.when(
        loading: () => const LoadingView(message: 'Loading users…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminUsersProvider),
        ),
        data: (items) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(adminUsersProvider),
          child: items.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: const EmptyStateView(
                        title: 'No users found',
                        message: 'Registered citizens and staff appear here.',
                        icon: Icons.group_outlined,
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _UserTile(user: items[index]),
                ),
        ),
      ),
    );
  }
}

class _UserTile extends ConsumerStatefulWidget {
  const _UserTile({required this.user});

  final AdminUserRow user;

  @override
  ConsumerState<_UserTile> createState() => _UserTileState();
}

class _UserTileState extends ConsumerState<_UserTile> {
  bool _busy = false;

  Future<void> _toggleStatus() async {
    final user = widget.user;
    final isActive = user.status.toLowerCase() == 'active';
    final next = isActive ? 'inactive' : 'active';

    setState(() => _busy = true);
    try {
      await ref.read(adminRepositoryProvider).setUserStatus(user.id, next);
      ref.invalidate(adminUsersProvider);
      if (mounted) {
        showAppSnackBar(context, 'User marked as $next');
      }
    } on ApiException catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final isActive = user.status.toLowerCase() == 'active';

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primarySoft,
                child: Text(
                  Formatters.initials(user.name),
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('@${user.username}', style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
                  ],
                ),
              ),
              StatusChip(status: Formatters.titleCase(user.status), dense: true),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              if (user.role.isNotEmpty)
                _Meta(icon: Icons.shield_outlined, text: Formatters.titleCase(user.role)),
              if (user.phone.isNotEmpty)
                _Meta(icon: Icons.phone_outlined, text: Formatters.phoneDisplay(user.phone)),
              if (user.nationalId.isNotEmpty)
                _Meta(icon: Icons.badge_outlined, text: user.nationalId),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _busy ? null : _toggleStatus,
            icon: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(isActive ? Icons.block_rounded : Icons.check_circle_outline_rounded),
            label: Text(isActive ? 'Deactivate' : 'Activate'),
            style: OutlinedButton.styleFrom(
              foregroundColor: isActive ? AppColors.danger : AppColors.success,
            ),
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
