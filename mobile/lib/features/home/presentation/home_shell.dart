import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/realtime_service.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/application/auth_controller.dart';
import '../../notifications/application/notifications_controller.dart';

/// Lets child screens (e.g. home banner menu) open the shell drawer.
class HomeShellScope extends InheritedWidget {
  const HomeShellScope({
    super.key,
    required this.openDrawer,
    required super.child,
  });

  final VoidCallback openDrawer;

  static HomeShellScope? maybeOf(BuildContext context) {
    return context.getInheritedWidgetOfExactType<HomeShellScope>();
  }

  @override
  bool updateShouldNotify(HomeShellScope oldWidget) =>
      openDrawer != oldWidget.openDrawer;
}

/// Citizen shell: bottom tabs + side drawer (native mobile, not web admin).
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
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

  @override
  Widget build(BuildContext context) {
    final index = widget.navigationShell.currentIndex;
    final unread = ref.watch(unreadNotificationCountProvider);
    final user = ref.watch(currentUserProvider);

    // Hard guard: never render citizen shell for staff roles.
    if (user != null && (user.isAdmin || user.isOperator)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        context.go(user.isAdmin ? AppRoutes.adminHome : AppRoutes.operatorHome);
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // Important: no extendBody / no FAB notch — those broke scroll on home.
    return HomeShellScope(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: const Color(0xFFF7F8FC),
        drawer: _NqsDrawer(
          userName: user?.displayName ?? 'Citizen',
          onNavigate: (route) {
            Navigator.of(context).pop();
            if (route.startsWith('branch:')) {
              _goBranch(int.parse(route.split(':').last));
              return;
            }
            context.push(route);
          },
          onLogout: () async {
            Navigator.of(context).pop();
            await ref.read(authControllerProvider.notifier).logout();
          },
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
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home_rounded,
                    label: 'Home',
                    selected: index == 0,
                    onTap: () => _goBranch(0),
                  ),
                  _Tab(
                    icon: Icons.grid_view_outlined,
                    activeIcon: Icons.grid_view_rounded,
                    label: 'Services',
                    selected: index == 1,
                    onTap: () => _goBranch(1),
                  ),
                  _Tab(
                    icon: Icons.event_note_outlined,
                    activeIcon: Icons.event_note_rounded,
                    label: 'Bookings',
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

class _NqsDrawer extends StatelessWidget {
  const _NqsDrawer({
    required this.userName,
    required this.onNavigate,
    required this.onLogout,
  });

  final String userName;
  final void Function(String route) onNavigate;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final items = <({IconData icon, String label, String route})>[
      (icon: Icons.home_rounded, label: 'Home', route: 'branch:0'),
      (icon: Icons.grid_view_rounded, label: 'Services', route: 'branch:1'),
      (icon: Icons.event_note_rounded, label: 'Bookings', route: 'branch:2'),
      (icon: Icons.location_city_rounded, label: 'Centers', route: AppRoutes.centers),
      (icon: Icons.timeline_rounded, label: 'Track queue', route: AppRoutes.track),
      (icon: Icons.notifications_rounded, label: 'Notifications', route: 'branch:3'),
      (icon: Icons.person_rounded, label: 'Profile', route: 'branch:4'),
      (icon: Icons.settings_rounded, label: 'Settings', route: AppRoutes.settings),
    ];

    return Drawer(
      backgroundColor: AppColors.navyDeepest,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
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
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'NQS',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                        Text(
                          'National ID',
                          style: TextStyle(color: Colors.white70, fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white24, height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
              child: Text(
                'Hello, $userName',
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
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
                      onTap: () => onNavigate(item.route),
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
