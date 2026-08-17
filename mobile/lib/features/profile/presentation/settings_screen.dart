import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/nqs_page_header.dart';
import '../../../shared/models/app_user.dart';
import '../../auth/application/auth_controller.dart';
import '../../home/application/protected_action.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeControllerProvider);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      backgroundColor: AppSurface.background(context),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: [
          NqsPageHeader(
            icon: Icons.settings_rounded,
            iconColor: AppColors.muted,
            title: 'Settings',
            subtitle: 'Manage your account and app preferences',
            onMenu: () => Navigator.of(context).maybePop(),
            bell: IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.close_rounded),
            ),
          ),
          const SizedBox(height: 18),
          _ProfileSummaryCard(user: user),
          const SizedBox(height: 20),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _SettingsRow(
                  icon: Icons.person_outline_rounded,
                  color: AppColors.primary,
                  label: 'Personal Information',
                  onTap: () {
                    if (!ensureSignedIn(
                      context,
                      ref,
                      ProtectedAction.profile,
                    )) {
                      return;
                    }
                    context.push(AppRoutes.profile);
                  },
                ),
                const Divider(height: 1, indent: 56),
                _SettingsRow(
                  icon: Icons.dark_mode_outlined,
                  color: const Color(0xFF7C3AED),
                  label: 'Dark Mode',
                  trailing: Switch(
                    value: themeMode == ThemeMode.dark,
                    onChanged: (value) => ref
                        .read(themeControllerProvider.notifier)
                        .set(value ? ThemeMode.dark : ThemeMode.light),
                  ),
                ),
                const Divider(height: 1, indent: 56),
                _SettingsRow(
                  icon: Icons.lock_outline_rounded,
                  color: AppColors.success,
                  label: 'Security & PIN',
                  onTap: () {
                    if (!ensureSignedIn(
                      context,
                      ref,
                      ProtectedAction.profile,
                    )) {
                      return;
                    }
                    context.push(AppRoutes.changePassword);
                  },
                ),
                const Divider(height: 1, indent: 56),
                _SettingsRow(
                  icon: Icons.support_agent_rounded,
                  color: AppColors.info,
                  label: 'Contact Us',
                  onTap: () => context.push(AppRoutes.contact),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _SettingsActionPanel(
            isAuthenticated: user != null,
            onHelp: () => context.push(AppRoutes.help),
            onLogout: () => _confirmLogout(context, ref),
            onSignIn: () => context.push(AppRoutes.login),
          ),
          const SizedBox(height: 22),
          AppSectionTitle(
            title: 'About',
            actionLabel: 'View details',
            onAction: () => context.push(AppRoutes.about),
          ),
          const SizedBox(height: 10),
          SectionCard(
            child: Column(
              children: [
                const Row(children: [BrandLogo(size: 44, showText: true)]),
                const SizedBox(height: 14),
                const Divider(),
                const DetailRow(
                  label: 'App version',
                  value: '1.1.16',
                  icon: Icons.info_outline_rounded,
                ),
                DetailRow(
                  label: 'Connected to',
                  value: Env.apiBaseUrl,
                  icon: Icons.cloud_outlined,
                ),
                const DetailRow(
                  label: 'System',
                  value: AppConstants.appTagline,
                  icon: Icons.account_balance_outlined,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Center(
            child: Text(
              'This app uses the same secure NQS services as the web portal.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
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
    if (context.mounted) context.go(AppRoutes.login);
  }
}

class _SettingsActionPanel extends StatelessWidget {
  const _SettingsActionPanel({
    required this.isAuthenticated,
    required this.onHelp,
    required this.onLogout,
    required this.onSignIn,
  });

  final bool isAuthenticated;
  final VoidCallback onHelp;
  final VoidCallback onLogout;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.navyDeepest,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Stack(
        children: [
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _SettingsPanelSkyline(),
          ),
          Column(
            children: [
              _SettingsActionRow(
                icon: Icons.settings_outlined,
                label: 'Settings',
                selected: true,
                onTap: () {},
              ),
              _SettingsActionRow(
                icon: Icons.help_outline_rounded,
                label: 'Help & Support',
                onTap: onHelp,
              ),
              const SizedBox(height: 18),
              _SettingsActionRow(
                icon: isAuthenticated
                    ? Icons.logout_rounded
                    : Icons.login_rounded,
                label: isAuthenticated ? 'Logout' : 'Sign In',
                color: isAuthenticated ? AppColors.danger : Colors.white,
                onTap: isAuthenticated ? onLogout : onSignIn,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SettingsActionRow extends StatelessWidget {
  const _SettingsActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
    this.selected = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final foreground = color ?? Colors.white;
    return Material(
      color: selected
          ? Colors.white.withValues(alpha: 0.04)
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          child: Row(
            children: [
              Icon(icon, color: foreground, size: 22),
              const SizedBox(width: 16),
              Text(
                label,
                style: TextStyle(
                  color: foreground,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsPanelSkyline extends StatelessWidget {
  const _SettingsPanelSkyline();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: SizedBox(
        height: 42,
        width: double.infinity,
        child: CustomPaint(painter: _SettingsPanelSkylinePainter()),
      ),
    );
  }
}

class _SettingsPanelSkylinePainter extends CustomPainter {
  static const _widths = [0.08, 0.12, 0.08, 0.1, 0.06, 0.1, 0.07, 0.09];
  static const _heights = [0.5, 0.32, 0.62, 0.28, 0.82, 0.44, 0.36, 0.68];

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.05);
    var x = 0.0;
    for (var i = 0; i < _widths.length; i++) {
      final w = size.width * _widths[i];
      final h = size.height * _heights[i];
      canvas.drawRect(Rect.fromLTWH(x, size.height - h, w, h), paint);
      x += w + 3;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({required this.user});

  final AppUser? user;

  @override
  Widget build(BuildContext context) {
    if (user == null) {
      return AppCard(
        onTap: () => context.push(AppRoutes.login),
        tintColor: AppColors.primary,
        child: Row(
          children: [
            const SoftIconBadge(
              icon: Icons.person_outline_rounded,
              color: AppColors.primary,
              size: 48,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sign in',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: AppSurface.ink(context),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Manage your account and preferences.',
                    style: TextStyle(
                      color: AppSurface.muted(context),
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: AppSurface.muted(context)),
          ],
        ),
      );
    }

    final u = user!;
    return AppCard(
      tintColor: AppColors.info,
      child: Row(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: AppSurface.tint(context, AppColors.info),
            child: Text(
              Formatters.initials(u.displayName),
              style: TextStyle(
                color: AppSurface.brand(context),
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  u.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: AppSurface.ink(context),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '@${u.username} · ${Formatters.phoneDisplay(u.phone)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppSurface.muted(context),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: () => context.push(AppRoutes.editProfile),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 34),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              textStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            child: const Text('Edit Profile'),
          ),
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.color,
    required this.label,
    this.onTap,
    this.trailing,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        child: Row(
          children: [
            SoftIconBadge(icon: icon, color: color, size: 34),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: AppSurface.ink(context),
                ),
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
    );
  }
}
