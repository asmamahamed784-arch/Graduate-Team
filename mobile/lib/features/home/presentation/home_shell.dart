import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/realtime_service.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/app_user.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/presentation/widgets/nqs_auth_page.dart';
import '../../notifications/application/notifications_controller.dart';
import '../application/protected_action.dart';

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
/// Guests reach this shell too — Home/Services/Centers stay open to browse;
/// Appointments/Queue/Notifications/Profile gate through [ensureSignedIn].
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

  void _closeDrawer() {
    if (Navigator.of(context).canPop()) Navigator.of(context).pop();
  }

  void _goBranch(int index) {
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  void _tapAppointments() {
    _closeDrawer();
    if (!ensureSignedIn(context, ref, ProtectedAction.myAppointments)) return;
    _goBranch(2);
  }

  void _tapQueue() {
    _closeDrawer();
    if (!ensureSignedIn(context, ref, ProtectedAction.trackQueue)) return;
    context.push(AppRoutes.track);
  }

  void _tapNotifications() {
    _closeDrawer();
    if (!ensureSignedIn(context, ref, ProtectedAction.notifications)) return;
    _goBranch(3);
  }

  void _tapProfile() {
    _closeDrawer();
    if (!ensureSignedIn(context, ref, ProtectedAction.profile)) return;
    _goBranch(4);
  }

  void _tapServices() {
    _closeDrawer();
    _goBranch(1);
  }

  void _tapCenters() {
    _closeDrawer();
    context.go(AppRoutes.centers);
  }

  void _tapSettings() {
    _closeDrawer();
    context.push(AppRoutes.settings);
  }

  void _tapAbout() {
    _closeDrawer();
    context.push(AppRoutes.about);
  }

  @override
  Widget build(BuildContext context) {
    final index = widget.navigationShell.currentIndex;
    final unread = ref.watch(unreadNotificationCountProvider);
    final user = ref.watch(currentUserProvider);
    final currentPath = GoRouterState.of(context).uri.path;
    final isQueueActive = currentPath == AppRoutes.track;

    // Important: no extendBody / no FAB notch — those broke scroll on home.
    return HomeShellScope(
      openDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppSurface.background(context),
        drawer: _NqsDrawer(
          user: user,
          unread: unread,
          currentIndex: index,
          currentPath: currentPath,
          onHome: () {
            _closeDrawer();
            _goBranch(0);
          },
          onServices: _tapServices,
          onCenters: _tapCenters,
          onAppointments: _tapAppointments,
          onQueue: _tapQueue,
          onNotifications: _tapNotifications,
          onSettings: _tapSettings,
          onAbout: _tapAbout,
        ),
        body: widget.navigationShell,
        bottomNavigationBar: _CitizenBottomBar(
          child: Row(
            children: [
              _Tab(
                icon: Icons.home_outlined,
                activeIcon: Icons.home_rounded,
                label: 'Home',
                selected: index == 0 && !isQueueActive,
                onTap: () {
                  _closeDrawer();
                  _goBranch(0);
                },
              ),
              _Tab(
                icon: Icons.calendar_today_outlined,
                activeIcon: Icons.calendar_month_rounded,
                label: 'Appointments',
                selected: index == 2 && !isQueueActive,
                onTap: _tapAppointments,
              ),
              _Tab(
                icon: Icons.groups_2_outlined,
                activeIcon: Icons.groups_2_rounded,
                label: 'Queue',
                selected: isQueueActive,
                onTap: _tapQueue,
              ),
              _Tab(
                icon: Icons.info_outline_rounded,
                activeIcon: Icons.info_rounded,
                label: 'About',
                selected: currentPath == AppRoutes.about,
                onTap: _tapAbout,
              ),
              _Tab(
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
                label: 'Profile',
                selected: index == 4 && !isQueueActive,
                onTap: _tapProfile,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CitizenBottomBar extends StatelessWidget {
  const _CitizenBottomBar({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = AppSurface.isDark(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppSurface.card(context),
        border: Border(top: BorderSide(color: AppSurface.border(context))),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.34 : 0.1),
            blurRadius: 18,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 66,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: child,
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
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final activeColor = AppColors.success;
    final inactiveColor = AppSurface.muted(context);
    final color = selected ? activeColor : inactiveColor;
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                width: 42,
                height: 25,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected
                      ? activeColor.withValues(alpha: 0.14)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Icon(
                  selected ? activeIcon : icon,
                  color: color,
                  size: 20,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  color: color,
                  height: 1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Main drawer navigation. Account actions live inside Settings.
class _NqsDrawer extends StatelessWidget {
  const _NqsDrawer({
    required this.user,
    required this.unread,
    required this.currentIndex,
    required this.currentPath,
    required this.onHome,
    required this.onServices,
    required this.onCenters,
    required this.onAppointments,
    required this.onQueue,
    required this.onNotifications,
    required this.onSettings,
    required this.onAbout,
  });

  final AppUser? user;
  final int unread;
  final int currentIndex;
  final String currentPath;
  final VoidCallback onHome;
  final VoidCallback onServices;
  final VoidCallback onCenters;
  final VoidCallback onAppointments;
  final VoidCallback onQueue;
  final VoidCallback onNotifications;
  final VoidCallback onSettings;
  final VoidCallback onAbout;

  @override
  Widget build(BuildContext context) {
    final items =
        <
          ({
            IconData icon,
            String label,
            bool selected,
            int badge,
            VoidCallback onTap,
          })
        >[
          (
            icon: Icons.home_rounded,
            label: 'Home',
            selected: currentIndex == 0 && currentPath != AppRoutes.track,
            badge: 0,
            onTap: onHome,
          ),
          (
            icon: Icons.event_note_rounded,
            label: 'Appointments',
            selected: currentIndex == 2,
            badge: 0,
            onTap: onAppointments,
          ),
          (
            icon: Icons.groups_2_rounded,
            label: 'Track Queue',
            selected: currentPath == AppRoutes.track,
            badge: 0,
            onTap: onQueue,
          ),
          (
            icon: Icons.credit_card_rounded,
            label: 'Services',
            selected: currentIndex == 1,
            badge: 0,
            onTap: onServices,
          ),
          (
            icon: Icons.location_city_rounded,
            label: 'Service Centers',
            selected:
                currentPath == AppRoutes.centers ||
                currentPath.startsWith('/centers/'),
            badge: 0,
            onTap: onCenters,
          ),
          (
            icon: Icons.notifications_none_rounded,
            label: 'Notifications',
            selected: currentIndex == 3,
            badge: unread,
            onTap: onNotifications,
          ),
          (
            icon: Icons.settings_outlined,
            label: 'Settings',
            selected: currentPath == AppRoutes.settings,
            badge: 0,
            onTap: onSettings,
          ),
          (
            icon: Icons.info_outline_rounded,
            label: 'About NQS',
            selected: currentPath == AppRoutes.about,
            badge: 0,
            onTap: onAbout,
          ),
        ];

    return Drawer(
      width: MediaQuery.sizeOf(context).width * 0.76,
      backgroundColor: AppColors.navyDeepest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Stack(
          children: [
            const Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _DrawerSkyline(),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                  child: Row(
                    children: [
                      const NqsCrest(size: 46),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'NQS',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 19,
                            ),
                          ),
                          Text(
                            'National ID',
                            style: TextStyle(
                              color: Color(0xFF9DB6DE),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  child: user == null
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Guest',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Sign in to access your account',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.65),
                                fontSize: 12.5,
                              ),
                            ),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Citizen User',
                              style: TextStyle(
                                color: Color(0xFF6FA0F5),
                                fontWeight: FontWeight.w700,
                                fontSize: 12.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              user!.displayName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 17,
                              ),
                            ),
                            if (user!.nationalId.trim().isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                'Citizen ID: ${user!.nationalId}',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.65),
                                  fontSize: 12.5,
                                ),
                              ),
                            ],
                          ],
                        ),
                ),
                Divider(height: 1, color: Colors.white.withValues(alpha: 0.12)),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(12, 14, 12, 10),
                    children: [
                      for (final item in items)
                        _DrawerRow(
                          icon: item.icon,
                          label: item.label,
                          selected: item.selected,
                          badge: item.badge,
                          onTap: item.onTap,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerRow extends StatelessWidget {
  const _DrawerRow({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: selected ? const Color(0xFF1A3A6E) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(
              children: [
                Icon(
                  icon,
                  color: selected
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.88),
                  size: 22,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ),
                if (badge > 0)
                  Container(
                    width: 22,
                    height: 22,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '$badge',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Faint city-skyline silhouette anchored to the bottom of the drawer —
/// the same motif as the Create Account screen, tuned for the dark navy
/// drawer background instead of a light page.
class _DrawerSkyline extends StatelessWidget {
  const _DrawerSkyline();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: SizedBox(
        height: 56,
        width: double.infinity,
        child: CustomPaint(painter: _DrawerSkylinePainter()),
      ),
    );
  }
}

class _DrawerSkylinePainter extends CustomPainter {
  static const _widths = [
    0.06,
    0.05,
    0.08,
    0.04,
    0.09,
    0.05,
    0.07,
    0.06,
    0.05,
    0.08,
    0.06,
    0.05,
  ];
  static const _heights = [
    0.5,
    0.8,
    0.35,
    0.95,
    0.45,
    0.7,
    0.3,
    0.85,
    0.55,
    0.4,
    0.75,
    0.5,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.05);
    var x = 0.0;
    for (var i = 0; i < _widths.length; i++) {
      final w = size.width * _widths[i];
      final h = size.height * _heights[i];
      canvas.drawRect(Rect.fromLTWH(x, size.height - h, w, h), paint);
      x += w + 2;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
