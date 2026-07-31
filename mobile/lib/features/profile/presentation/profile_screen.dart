import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../auth/application/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will need your password to sign back in.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Stay signed in'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(authControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final history = ref.watch(appointmentHistoryProvider);
    final active = ref.watch(activeAppointmentsProvider);

    if (user == null) {
      return const Scaffold(body: LoadingView());
    }

    final summary = user.summary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            tooltip: 'Settings',
            onPressed: () => context.push(AppRoutes.settings),
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(authControllerProvider.notifier).refreshProfile(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            SectionCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: AppColors.navy.withValues(alpha: 0.12),
                    child: Text(
                      Formatters.initials(user.displayName),
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontWeight: FontWeight.w700,
                        fontSize: 19,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.displayName,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '@${user.username}',
                          style: const TextStyle(color: AppColors.muted, fontSize: 13),
                        ),
                        const SizedBox(height: 8),
                        StatusChip(status: Formatters.titleCase(user.status), dense: true),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _StatTile(
                    label: 'Active',
                    value: '${active.length}',
                    icon: Icons.pending_actions_rounded,
                    color: AppColors.accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatTile(
                    label: 'Completed',
                    value: '${history.length}',
                    icon: Icons.history_rounded,
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const SectionHeader(title: 'National ID'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'ID number',
                    value: summary?.nationalIdNumber.isNotEmpty == true
                        ? summary!.nationalIdNumber
                        : user.nationalId,
                    icon: Icons.badge_outlined,
                    copyable: true,
                  ),
                  DetailRow(
                    label: 'ID status',
                    value: Formatters.titleCase(
                      summary?.nationalIdStatus.isNotEmpty == true
                          ? summary!.nationalIdStatus
                          : user.nationalIdStatus,
                    ),
                    icon: Icons.verified_outlined,
                  ),
                  DetailRow(
                    label: 'Card status',
                    value: Formatters.titleCase(user.cardStatus),
                    icon: Icons.credit_card_rounded,
                  ),
                  if (user.cardExpiryDate != null)
                    DetailRow(
                      label: 'Expires',
                      value: Formatters.shortDate(user.cardExpiryDate),
                      icon: Icons.event_busy_outlined,
                    ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const SectionHeader(title: 'Personal information'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Phone',
                    value: Formatters.phoneDisplay(user.phone),
                    icon: Icons.phone_outlined,
                  ),
                  DetailRow(
                    label: 'Email',
                    value: user.email ?? '--',
                    icon: Icons.mail_outline_rounded,
                  ),
                  DetailRow(
                    label: 'Date of birth',
                    value: user.dateOfBirth.isEmpty ? '--' : user.dateOfBirth,
                    icon: Icons.cake_outlined,
                  ),
                  DetailRow(
                    label: 'Address',
                    value: user.address,
                    icon: Icons.home_outlined,
                  ),
                  DetailRow(
                    label: 'Member since',
                    value: Formatters.shortDate(user.createdAt),
                    icon: Icons.event_available_outlined,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            _ActionTile(
              icon: Icons.edit_outlined,
              label: 'Edit profile',
              onTap: () => context.push(AppRoutes.editProfile),
            ),
            _ActionTile(
              icon: Icons.lock_outline_rounded,
              label: 'Change password',
              onTap: () => context.push(AppRoutes.changePassword),
            ),
            _ActionTile(
              icon: Icons.history_rounded,
              label: 'Appointment history',
              onTap: () => context.push(AppRoutes.history),
            ),
            _ActionTile(
              icon: Icons.location_city_outlined,
              label: 'Service centers',
              onTap: () => context.push(AppRoutes.centers),
            ),
            _ActionTile(
              icon: Icons.settings_outlined,
              label: 'Settings and appearance',
              onTap: () => context.push(AppRoutes.settings),
            ),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: () => _logout(context, ref),
              icon: const Icon(Icons.logout_rounded, size: 19),
              label: const Text('Sign out'),
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 19, color: color),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SectionCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.navy),
            const SizedBox(width: 14),
            Expanded(
              child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}
