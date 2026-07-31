import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/realtime_service.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/application/auth_controller.dart';
import '../../notifications/application/notifications_controller.dart';
import '../../../shared/widgets/role_drawer.dart';

/// Admin shell: bottom tabs + side drawer (mobile-first, no extendBody / FAB).
class AdminShell extends ConsumerStatefulWidget {
  const AdminShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends ConsumerState<AdminShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = ref.read(currentUserProvider);
      ref.read(realtimeServiceProvider).connect(userId: user?.id);
    });
  }

  void _goBranch(int index) {
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  void _closeDrawerAnd(VoidCallback action) {
    Navigator.of(context).pop();
    action();
  }

  @override
  Widget build(BuildContext context) {
    final index = widget.navigationShell.currentIndex;
    final unread = ref.watch(unreadNotificationCountProvider);
    final user = ref.watch(currentUserProvider);

    if (user != null && !user.isAdmin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        context.go(user.isOperator ? AppRoutes.operatorHome : AppRoutes.home);
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return ShellDrawerScope(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppColors.lightBackground,
        drawer: RoleDrawer(
          title: 'NQS',
          subtitle: 'Administrator',
          userName: user?.displayName ?? 'Admin',
          userEmail: user?.email ?? user?.username,
          roleLabel: 'Administrator',
          onLogout: () => _closeDrawerAnd(() async {
            await ref.read(authControllerProvider.notifier).logout();
            if (context.mounted) context.go(AppRoutes.login);
          }),
          items: [
            RoleDrawerItem(
              icon: Icons.dashboard_rounded,
              label: 'Admin Dashboard',
              onTap: () => _closeDrawerAnd(() => _goBranch(0)),
            ),
            RoleDrawerItem(
              icon: Icons.event_note_rounded,
              label: 'Appointments',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminAppointments)),
            ),
            RoleDrawerItem(
              icon: Icons.badge_rounded,
              label: 'Operators',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminOperators)),
            ),
            RoleDrawerItem(
              icon: Icons.group_rounded,
              label: 'User Management',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminUsers)),
            ),
            RoleDrawerItem(
              icon: Icons.devices_rounded,
              label: 'Active Sessions',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminSessions)),
            ),
            RoleDrawerItem(
              icon: Icons.analytics_rounded,
              label: 'Reports',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminReports)),
            ),
            RoleDrawerItem(
              icon: Icons.grid_view_rounded,
              label: 'Manage Services',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminServices)),
            ),
            RoleDrawerItem(
              icon: Icons.location_city_rounded,
              label: 'Manage Centers',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminCenters)),
            ),
            RoleDrawerItem(
              icon: Icons.qr_code_scanner_rounded,
              label: 'QR Scan',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminQrScan)),
            ),
            RoleDrawerItem(
              icon: Icons.notifications_rounded,
              label: 'Notifications',
              onTap: () => _closeDrawerAnd(() => _goBranch(3)),
            ),
            RoleDrawerItem(
              icon: Icons.history_rounded,
              label: 'Activity Logs',
              onTap: () => _closeDrawerAnd(() => context.push(AppRoutes.adminActivity)),
            ),
            RoleDrawerItem(
              icon: Icons.person_rounded,
              label: 'Profile',
              onTap: () => _closeDrawerAnd(() => _goBranch(4)),
            ),
          ],
        ),
        body: widget.navigationShell,
        bottomNavigationBar: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 16,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: SizedBox(
              height: 64,
              child: Row(
                children: [
                  _AdminTab(
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home_rounded,
                    label: 'Home',
                    selected: index == 0,
                    onTap: () => _goBranch(0),
                  ),
                  _AdminTab(
                    icon: Icons.inbox_outlined,
                    activeIcon: Icons.inbox_rounded,
                    label: 'Requests',
                    selected: index == 1,
                    onTap: () => _goBranch(1),
                  ),
                  _AdminTab(
                    icon: Icons.people_alt_outlined,
                    activeIcon: Icons.people_alt_rounded,
                    label: 'Queue',
                    selected: index == 2,
                    onTap: () => _goBranch(2),
                  ),
                  _AdminTab(
                    icon: Icons.notifications_outlined,
                    activeIcon: Icons.notifications_rounded,
                    label: 'Alerts',
                    selected: index == 3,
                    badge: unread,
                    onTap: () => _goBranch(3),
                  ),
                  _AdminTab(
                    icon: Icons.person_outline_rounded,
                    activeIcon: Icons.person_rounded,
                    label: 'Profile',
                    selected: index == 4,
                    onTap: () => _goBranch(4),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AdminTab extends StatelessWidget {
  const _AdminTab({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : const Color(0xFF9CA3AF);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: selected ? AppColors.primarySoft : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Badge(
                isLabelVisible: badge > 0,
                label: Text('$badge'),
                child: Icon(selected ? activeIcon : icon, color: color, size: 22),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
