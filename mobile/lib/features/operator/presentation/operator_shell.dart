import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/realtime_service.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/application/auth_controller.dart';
import '../../notifications/application/notifications_controller.dart';
import '../operator_routes.dart';
import '../../../shared/widgets/role_drawer.dart';

/// Operator shell: bottom tabs + navy side drawer.
class OperatorShell extends ConsumerStatefulWidget {
  const OperatorShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<OperatorShell> createState() => _OperatorShellState();
}

class _OperatorShellState extends ConsumerState<OperatorShell> {
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

  void _closeDrawerAndNavigate(String route) {
    Navigator.of(context).pop();
    if (route.startsWith('branch:')) {
      _goBranch(int.parse(route.split(':').last));
      return;
    }
    context.push(route);
  }

  @override
  Widget build(BuildContext context) {
    final index = widget.navigationShell.currentIndex;
    final unread = ref.watch(unreadNotificationCountProvider);
    final user = ref.watch(currentUserProvider);

    // Keep roles separated — citizen/admin never stay on operator shell.
    if (user != null && !user.isOperator) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        context.go(user.isAdmin ? AppRoutes.adminHome : AppRoutes.home);
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return ShellDrawerScope(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppColors.lightBackground,
        drawer: RoleDrawer(
          title: 'NQS Operator',
          subtitle: 'Service center',
          userName: user?.displayName ?? 'Operator',
          userEmail: user?.email ?? user?.username,
          roleLabel: 'Operator',
          onLogout: () async {
            Navigator.of(context).pop();
            await ref.read(authControllerProvider.notifier).logout();
            if (context.mounted) context.go(AppRoutes.login);
          },
          items: [
            RoleDrawerItem(
              icon: Icons.dashboard_rounded,
              label: 'Dashboard',
              onTap: () => _closeDrawerAndNavigate('branch:0'),
            ),
            RoleDrawerItem(
              icon: Icons.people_alt_rounded,
              label: 'Current Queue',
              onTap: () => _closeDrawerAndNavigate('branch:1'),
            ),
            RoleDrawerItem(
              icon: Icons.call_made_rounded,
              label: 'Call Next',
              onTap: () => _closeDrawerAndNavigate('branch:2'),
            ),
            RoleDrawerItem(
              icon: Icons.qr_code_scanner_rounded,
              label: 'QR Scanner',
              onTap: () => _closeDrawerAndNavigate(OperatorRoutes.operatorQrScan),
            ),
            RoleDrawerItem(
              icon: Icons.person_search_rounded,
              label: 'Citizen Details',
              onTap: () => _closeDrawerAndNavigate(OperatorRoutes.operatorCitizenDetail),
            ),
            RoleDrawerItem(
              icon: Icons.edit_note_rounded,
              label: 'Correction Requests',
              onTap: () => _closeDrawerAndNavigate(OperatorRoutes.operatorCorrections),
            ),
            RoleDrawerItem(
              icon: Icons.check_circle_outline_rounded,
              label: 'Completed Services',
              onTap: () => _closeDrawerAndNavigate(OperatorRoutes.operatorCompleted),
            ),
            RoleDrawerItem(
              icon: Icons.notifications_rounded,
              label: 'Notifications',
              onTap: () => _closeDrawerAndNavigate('branch:3'),
            ),
            RoleDrawerItem(
              icon: Icons.person_rounded,
              label: 'Profile',
              onTap: () => _closeDrawerAndNavigate('branch:4'),
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
                  _Tab(
                    icon: Icons.dashboard_outlined,
                    activeIcon: Icons.dashboard_rounded,
                    label: 'Dashboard',
                    selected: index == 0,
                    onTap: () => _goBranch(0),
                  ),
                  _Tab(
                    icon: Icons.people_outline_rounded,
                    activeIcon: Icons.people_alt_rounded,
                    label: 'Queue',
                    selected: index == 1,
                    onTap: () => _goBranch(1),
                  ),
                  _Tab(
                    icon: Icons.call_missed_outgoing_rounded,
                    activeIcon: Icons.call_made_rounded,
                    label: 'Call Next',
                    selected: index == 2,
                    onTap: () => _goBranch(2),
                  ),
                  _Tab(
                    icon: Icons.notifications_outlined,
                    activeIcon: Icons.notifications_rounded,
                    label: 'Alerts',
                    selected: index == 3,
                    badge: unread,
                    onTap: () => _goBranch(3),
                  ),
                  _Tab(
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

class _Tab extends StatelessWidget {
  const _Tab({
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
