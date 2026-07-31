import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class RoleDrawerItem {
  const RoleDrawerItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

/// Navy side drawer used by admin / operator / citizen shells.
class RoleDrawer extends StatelessWidget {
  const RoleDrawer({
    super.key,
    required this.title,
    required this.subtitle,
    required this.userName,
    required this.items,
    required this.onLogout,
    this.userEmail,
    this.roleLabel,
  });

  final String title;
  final String subtitle;
  final String userName;
  final String? userEmail;
  final String? roleLabel;
  final List<RoleDrawerItem> items;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AppColors.navyDeepest,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Text(
                      'NQ',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                        fontSize: 17,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          userName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 13.5,
                          ),
                        ),
                        if (userEmail != null && userEmail!.trim().isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            userEmail!,
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ],
                        const SizedBox(height: 4),
                        Text(
                          roleLabel ?? subtitle,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.75),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white24, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  for (final item in items)
                    ListTile(
                      leading: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(item.icon, color: Colors.white, size: 18),
                      ),
                      title: Text(
                        item.label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onTap: item.onTap,
                    ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.logout_rounded, color: Colors.white70),
              title: const Text('Sign out', style: TextStyle(color: Colors.white70)),
              onTap: onLogout,
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

/// Lets child screens open the shell drawer.
class ShellDrawerScope extends InheritedWidget {
  const ShellDrawerScope({
    super.key,
    required this.openDrawer,
    required super.child,
  });

  final VoidCallback openDrawer;

  static ShellDrawerScope? maybeOf(BuildContext context) {
    return context.getInheritedWidgetOfExactType<ShellDrawerScope>();
  }

  @override
  bool updateShouldNotify(ShellDrawerScope oldWidget) =>
      openDrawer != oldWidget.openDrawer;
}
