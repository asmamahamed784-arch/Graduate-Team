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

class AdminSessionsScreen extends ConsumerWidget {
  const AdminSessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(adminSessionsProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Active Sessions')),
      body: sessions.when(
        loading: () => const LoadingView(message: 'Loading sessions…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminSessionsProvider),
        ),
        data: (items) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(adminSessionsProvider),
          child: items.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: const EmptyStateView(
                        title: 'No active sessions',
                        message: 'Signed-in devices will appear here.',
                        icon: Icons.devices_outlined,
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _SessionTile(session: items[index]),
                ),
        ),
      ),
    );
  }
}

class _SessionTile extends ConsumerStatefulWidget {
  const _SessionTile({required this.session});

  final AdminSessionRow session;

  @override
  ConsumerState<_SessionTile> createState() => _SessionTileState();
}

class _SessionTileState extends ConsumerState<_SessionTile> {
  bool _busy = false;

  Future<void> _invalidate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Invalidate session?'),
        content: Text('Sign out ${widget.session.userName} on this device?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Invalidate')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      await ref.read(adminRepositoryProvider).invalidateSession(widget.session.id);
      ref.invalidate(adminSessionsProvider);
      if (mounted) showAppSnackBar(context, 'Session invalidated');
    } on ApiException catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.devices_rounded, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  session.userName.isNotEmpty ? session.userName : 'Unknown user',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (session.role.isNotEmpty)
                StatusChip(status: Formatters.titleCase(session.role), dense: true),
            ],
          ),
          const SizedBox(height: 10),
          if (session.device.isNotEmpty)
            DetailRow(label: 'Device', value: session.device, icon: Icons.phone_android_rounded),
          if (session.ip.isNotEmpty)
            DetailRow(label: 'IP', value: session.ip, icon: Icons.language_rounded),
          DetailRow(
            label: 'Started',
            value: Formatters.dateTime(session.createdAt),
            icon: Icons.schedule_rounded,
          ),
          DetailRow(
            label: 'Last active',
            value: Formatters.dateTime(session.lastActiveAt),
            icon: Icons.update_rounded,
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _busy ? null : _invalidate,
            icon: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Invalidate'),
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
          ),
        ],
      ),
    );
  }
}
