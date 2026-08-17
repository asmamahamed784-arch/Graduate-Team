import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/app_user.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_controller.dart';
import '../../home/presentation/home_shell.dart';
import '../../notifications/application/notifications_controller.dart';

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
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(authControllerProvider.notifier).logout();
    if (context.mounted) context.go(AppRoutes.login);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final unread = ref.watch(unreadNotificationCountProvider);
    final themeMode = ref.watch(themeControllerProvider);

    if (user == null) {
      return const Scaffold(body: LoadingView());
    }

    return Scaffold(
      backgroundColor: AppSurface.background(context),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(authControllerProvider.notifier).refreshProfile(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: tabListPadding(context),
          children: [
            _ProfileTopBar(unread: unread),
            const SizedBox(height: 18),
            Text(
              'Settings',
              style: TextStyle(
                color: AppSurface.brand(context),
                fontSize: 24,
                fontWeight: FontWeight.w900,
                height: 1,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              'Manage your account and app preferences',
              style: TextStyle(
                color: AppSurface.muted(context),
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 18),
            _ProfileSummaryCard(user: user),
            const SizedBox(height: 18),
            _SettingsList(
              children: [
                _SettingsListRow(
                  icon: Icons.person_outline_rounded,
                  iconColor: AppColors.primary,
                  title: 'Personal Information',
                  subtitle: 'View and update your personal details',
                  onTap: () => context.push(AppRoutes.editProfile),
                ),
                _SettingsListRow(
                  icon: Icons.language_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  title: 'Language',
                  subtitle: 'Choose your preferred language',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: AppSurface.tint(context, AppColors.primary),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'English',
                          style: TextStyle(
                            color: AppSurface.brand(context),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: AppSurface.muted(context),
                      ),
                    ],
                  ),
                ),
                _SettingsListRow(
                  icon: Icons.dark_mode_outlined,
                  iconColor: const Color(0xFF3B82F6),
                  title: 'Dark Mode',
                  subtitle: 'Switch between light and dark theme',
                  trailing: Switch(
                    value: themeMode == ThemeMode.dark,
                    onChanged: (value) => ref
                        .read(themeControllerProvider.notifier)
                        .set(value ? ThemeMode.dark : ThemeMode.light),
                  ),
                ),
                _SettingsListRow(
                  icon: Icons.notifications_none_rounded,
                  iconColor: const Color(0xFFF59E0B),
                  title: 'Notifications',
                  subtitle: 'Manage app notification preferences',
                  trailing: Switch(
                    value: true,
                    activeThumbColor: AppColors.primary,
                    onChanged: (_) => context.go(AppRoutes.notifications),
                  ),
                  onTap: () => context.go(AppRoutes.notifications),
                ),
                _SettingsListRow(
                  icon: Icons.lock_outline_rounded,
                  iconColor: AppColors.success,
                  title: 'Security & PIN',
                  subtitle: 'Manage your PIN and security settings',
                  onTap: () => context.push(AppRoutes.changePassword),
                ),
                _SettingsListRow(
                  icon: Icons.shield_outlined,
                  iconColor: const Color(0xFF2563EB),
                  title: 'Privacy',
                  subtitle: 'Manage your privacy and data',
                ),
                _SettingsListRow(
                  icon: Icons.logout_rounded,
                  iconColor: AppColors.danger,
                  title: 'Logout',
                  subtitle: 'Sign out from your account',
                  titleColor: AppColors.danger,
                  onTap: () => _logout(context, ref),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileTopBar extends ConsumerWidget {
  const _ProfileTopBar({required this.unread});

  final int unread;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 4),
      child: Row(
        children: [
          IconButton(
            onPressed: () => HomeShellScope.maybeOf(context)?.openDrawer(),
            icon: Icon(Icons.menu_rounded, color: AppSurface.ink(context)),
            tooltip: 'Menu',
          ),
          const SizedBox(width: 4),
          Image.asset(
            'assets/images/crest.png',
            width: 32,
            height: 32,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'NQS',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppSurface.brand(context),
                fontSize: 22,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.3,
              ),
            ),
          ),
          HeaderBellButton(
            unread: unread,
            onTap: () => context.go(AppRoutes.notifications),
          ),
        ],
      ),
    );
  }
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      radius: 12,
      padding: const EdgeInsets.all(14),
      tintColor: AppColors.primary,
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: AppSurface.tint(context, AppColors.primary),
            child: Text(
              Formatters.initials(user.displayName),
              style: TextStyle(
                color: AppSurface.brand(context),
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppSurface.ink(context),
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                _ProfileMetaLine(
                  icon: Icons.badge_outlined,
                  text: user.nationalId.trim().isEmpty
                      ? user.username
                      : user.nationalId,
                ),
                const SizedBox(height: 3),
                _ProfileMetaLine(
                  icon: Icons.phone_outlined,
                  text: Formatters.phoneDisplay(user.phone),
                ),
              ],
            ),
          ),
          OutlinedButton.icon(
            onPressed: () => context.push(AppRoutes.editProfile),
            icon: const Icon(Icons.edit_outlined, size: 14),
            label: const Text('Edit Profile'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
              minimumSize: const Size(0, 34),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              textStyle: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileMetaLine extends StatelessWidget {
  const _ProfileMetaLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 13, color: AppSurface.muted(context)),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            text.trim().isEmpty ? '--' : text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppSurface.muted(context),
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _SettingsList extends StatelessWidget {
  const _SettingsList({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      radius: 12,
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i != children.length - 1)
              Divider(height: 1, indent: 64, color: AppSurface.border(context)),
          ],
        ],
      ),
    );
  }
}

class _SettingsListRow extends StatelessWidget {
  const _SettingsListRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.titleColor,
    this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final Color? titleColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              SoftIconBadge(icon: icon, color: iconColor, size: 38),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: titleColor ?? AppSurface.ink(context),
                        fontSize: 13.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppSurface.muted(context),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              trailing ??
                  Icon(
                    Icons.chevron_right_rounded,
                    color: AppSurface.muted(context),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
