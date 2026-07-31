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

class AdminOperatorsScreen extends ConsumerWidget {
  const AdminOperatorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final operators = ref.watch(adminOperatorsProvider);

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Operators')),
      body: operators.when(
        loading: () => const LoadingView(message: 'Loading operators…'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(adminOperatorsProvider),
        ),
        data: (items) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(adminOperatorsProvider),
          child: items.isEmpty
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: constraints.maxHeight,
                      child: const EmptyStateView(
                        title: 'No operators yet',
                        message: 'Operator accounts will appear here for approval.',
                        icon: Icons.badge_outlined,
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _OperatorTile(operator: items[index]),
                ),
        ),
      ),
    );
  }
}

class _OperatorTile extends ConsumerStatefulWidget {
  const _OperatorTile({required this.operator});

  final AdminOperatorRow operator;

  @override
  ConsumerState<_OperatorTile> createState() => _OperatorTileState();
}

class _OperatorTileState extends ConsumerState<_OperatorTile> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, String message) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(adminOperatorsProvider);
      if (mounted) showAppSnackBar(context, message);
    } on ApiException catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final op = widget.operator;
    final status = op.status.toLowerCase();
    final repo = ref.read(adminRepositoryProvider);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primarySoft,
                child: Text(
                  Formatters.initials(op.name),
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(op.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('@${op.username}', style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
                  ],
                ),
              ),
              StatusChip(status: Formatters.titleCase(op.status), dense: true),
            ],
          ),
          if (op.centerName.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.location_city_outlined, size: 16, color: AppColors.muted),
                const SizedBox(width: 6),
                Expanded(child: Text(op.centerName, style: const TextStyle(fontSize: 13))),
              ],
            ),
          ],
          if (op.phone.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.phone_outlined, size: 16, color: AppColors.muted),
                const SizedBox(width: 6),
                Text(Formatters.phoneDisplay(op.phone), style: const TextStyle(fontSize: 13)),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (status == 'pending') ...[
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() => repo.approveOperator(op.id), 'Operator approved'),
                  child: const Text('Approve'),
                ),
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() => repo.rejectOperator(op.id), 'Operator rejected'),
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                  child: const Text('Reject'),
                ),
              ],
              if (status == 'active' || op.isActive)
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() => repo.deactivateOperator(op.id), 'Operator deactivated'),
                  child: const Text('Deactivate'),
                ),
              if (status == 'inactive' || status == 'deactivated')
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() => repo.activateOperator(op.id), 'Operator activated'),
                  child: const Text('Activate'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
