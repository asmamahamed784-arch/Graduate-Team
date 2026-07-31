import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/models/service.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../auth/application/auth_controller.dart';
import '../../centers/data/center_repository.dart';
import '../../notifications/application/notifications_controller.dart';
import '../../services/data/service_repository.dart';
import 'home_shell.dart';

/// Citizen home — native mobile layout (banner + grids + lists), scrollable.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _bannerIndex = 0;

  Future<void> _refresh() async {
    await Future.wait([
      ref.read(authControllerProvider.notifier).refreshProfile(),
      ref.read(appointmentsControllerProvider.notifier).refresh(),
      ref.read(notificationsControllerProvider.notifier).refresh(),
    ]);
    ref.invalidate(servicesProvider);
    ref.invalidate(centersProvider);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);

    // Safety net if router redirect is skipped — admin never sees citizen UI.
    if (user != null && user.isAdmin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go(AppRoutes.adminHome);
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (user != null && user.isOperator) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go(AppRoutes.operatorHome);
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final current = ref.watch(currentAppointmentProvider);
    final services = ref.watch(activeServicesProvider);
    final centers = ref.watch(activeCentersProvider);
    final unread = ref.watch(unreadNotificationCountProvider);
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final centerItems = centers.isEmpty
        ? const <({String title, String subtitle, String? id})>[
            (title: 'No centers yet', subtitle: 'Pull to refresh', id: null),
          ]
        : centers
            .take(8)
            .map(
              (c) => (
                title: c.name,
                subtitle: c.district.isEmpty ? c.city : c.district,
                id: c.id,
              ),
            )
            .toList();

    // Single ListView only — no PageView / nested scrollables (those break
    // vertical scroll on Android emulators with mouse/touch drag).
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _refresh,
      child: ListView(
        primary: true,
        physics: const AlwaysScrollableScrollPhysics(
          parent: ClampingScrollPhysics(),
        ),
        padding: EdgeInsets.only(bottom: 24 + bottomInset + 72),
        children: [
          _BannerHeader(
            index: _bannerIndex,
            onSelect: (i) => setState(() => _bannerIndex = i),
            onOpenMenu: () => HomeShellScope.maybeOf(context)?.openDrawer(),
            unread: unread,
            onAlerts: () => context.go(AppRoutes.notifications),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _GreetingRow(name: user?.displayName ?? 'Citizen'),
                const SizedBox(height: 8),
                _StatusChip(
                  status: user?.summary?.nationalIdStatus ??
                      user?.nationalIdStatus ??
                      'NOT_STARTED',
                ),
                if (current != null) ...[
                  const SizedBox(height: 18),
                  const SectionHeader(title: 'Active request'),
                  _ActiveRequestCard(appointment: current),
                ],
                const SizedBox(height: 22),
                SectionHeader(
                  title: 'Services',
                  actionLabel: 'See all',
                  onAction: () => context.go(AppRoutes.services),
                ),
                const _ServicesGrid(),
                const SizedBox(height: 22),
                SectionHeader(
                  title: 'Centers',
                  actionLabel: 'View all',
                  onAction: () => context.push(AppRoutes.centers),
                ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (var i = 0; i < centerItems.length; i++) ...[
                        if (i > 0) const SizedBox(width: 10),
                        _CenterChip(
                          title: centerItems[i].title,
                          subtitle: centerItems[i].subtitle,
                          onTap: () {
                            final id = centerItems[i].id;
                            if (id == null) {
                              context.push(AppRoutes.centers);
                            } else {
                              context.push(AppRoutes.centerDetail(id));
                            }
                          },
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                SectionHeader(
                  title: 'Popular services',
                  actionLabel: 'Browse',
                  onAction: () => context.go(AppRoutes.services),
                ),
                if (services.isEmpty)
                  const SectionCard(
                    child: Text(
                      'Services will appear here once they are published.',
                      style: TextStyle(color: AppColors.muted),
                    ),
                  )
                else
                  ...services.take(5).map((service) => _ServiceTile(service: service)),
                const SizedBox(height: 12),
                SectionCard(
                  onTap: () => context.push(AppRoutes.track),
                  child: const Row(
                    children: [
                      Icon(Icons.timeline_rounded, color: AppColors.primary),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Track your queue live',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BannerHeader extends StatelessWidget {
  const _BannerHeader({
    required this.index,
    required this.onSelect,
    required this.onOpenMenu,
    required this.unread,
    required this.onAlerts,
  });

  final int index;
  final ValueChanged<int> onSelect;
  final VoidCallback onOpenMenu;
  final int unread;
  final VoidCallback onAlerts;

  static const _banners = [
    (
      'Book National ID',
      'Schedule your appointment from home.',
      [AppColors.navyDeepest, AppColors.primary],
      Icons.badge_rounded,
    ),
    (
      'Track your queue',
      'Live updates before you arrive.',
      [Color(0xFF0F766E), Color(0xFF14B8A6)],
      Icons.timeline_rounded,
    ),
    (
      'Replace lost ID',
      'Start a replacement request anytime.',
      [Color(0xFF9A3412), Color(0xFFF97316)],
      Icons.credit_card_off_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final safeTop = MediaQuery.paddingOf(context).top;
    final b = _banners[index.clamp(0, _banners.length - 1)];

    return Container(
      // Tall enough that the rest of the page must scroll on phone/emulator.
      constraints: BoxConstraints(minHeight: 200 + safeTop),
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 0),
      padding: EdgeInsets.fromLTRB(20, safeTop + 56, 20, 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: b.$3,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _CircleBtn(icon: Icons.apps_rounded, onTap: onOpenMenu),
              const Spacer(),
              _CircleBtn(
                icon: Icons.notifications_none_rounded,
                badge: unread,
                onTap: onAlerts,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      b.$1,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      b.$2,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.88),
                        fontSize: 13.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(b.$4, color: Colors.white.withValues(alpha: 0.9), size: 48),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: List.generate(_banners.length, (i) {
              final active = i == index;
              return GestureDetector(
                onTap: () => onSelect(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 6),
                  width: active ? 16 : 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: active ? 1 : 0.45),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _CircleBtn extends StatelessWidget {
  const _CircleBtn({
    required this.icon,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 42,
          height: 42,
          child: Center(
            child: Badge(
              isLabelVisible: badge > 0,
              label: Text('$badge'),
              child: Icon(icon, color: AppColors.ink, size: 22),
            ),
          ),
        ),
      ),
    );
  }
}

class _GreetingRow extends StatelessWidget {
  const _GreetingRow({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: AppColors.primarySoft,
          child: Text(
            Formatters.initials(name),
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Welcome back', style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.badge_outlined, size: 18, color: AppColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'National ID status: ${Formatters.titleCase(status)}',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServicesGrid extends ConsumerWidget {
  const _ServicesGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(currentAppointmentProvider);
    final tiles = [
      (
        AppConstants.newIdServiceName,
        'New National ID',
        Icons.badge_rounded,
        const Color(0xFFFF7A45),
      ),
      (
        AppConstants.replaceIdServiceName,
        'Replace lost ID',
        Icons.credit_card_off_rounded,
        const Color(0xFF8B5CF6),
      ),
      (
        AppConstants.updateInfoServiceName,
        'Update details',
        Icons.edit_document,
        const Color(0xFF22C55E),
      ),
      (
        AppConstants.renewIdServiceName,
        'Renew ID',
        Icons.autorenew_rounded,
        const Color(0xFF0EA5E9),
      ),
      (
        null,
        'Track queue',
        Icons.timeline_rounded,
        AppColors.accent,
      ),
      (
        null,
        'Book appointment',
        Icons.event_available_rounded,
        const Color(0xFF14B8A6),
      ),
      (
        null,
        'My ticket',
        Icons.qr_code_2_rounded,
        const Color(0xFFEF4444),
      ),
      (
        null,
        'Service centers',
        Icons.location_city_rounded,
        const Color(0xFFF59E0B),
      ),
    ];

    Widget tile(String? serviceName, String label, IconData icon, Color color) {
      return Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            if (serviceName == null) {
              if (label == 'Track queue') {
                context.push(AppRoutes.track);
              } else if (label == 'Book appointment') {
                context.go(AppRoutes.services);
              } else if (label == 'My ticket') {
                if (current != null && current.reference.isNotEmpty) {
                  context.push(AppRoutes.ticket(current.reference));
                } else {
                  context.go(AppRoutes.appointments);
                }
              } else {
                context.push(AppRoutes.centers);
              }
              return;
            }
            final services = ref.read(activeServicesProvider);
            final match = services.where((s) {
              final name = s.name.toLowerCase();
              if (serviceName == AppConstants.renewIdServiceName) {
                return name.contains('renew');
              }
              return name == serviceName.toLowerCase();
            });
            if (match.isEmpty) {
              context.go(AppRoutes.services);
              return;
            }
            context.push(AppRoutes.book(match.first.id));
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: color, size: 28),
                const SizedBox(height: 10),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Plain rows — avoid nested GridView scrollables on Android emulator.
    return Column(
      children: [
        for (var i = 0; i < tiles.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: tile(tiles[i].$1, tiles[i].$2, tiles[i].$3, tiles[i].$4),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: i + 1 < tiles.length
                    ? tile(
                        tiles[i + 1].$1,
                        tiles[i + 1].$2,
                        tiles[i + 1].$3,
                        tiles[i + 1].$4,
                      )
                    : const SizedBox(),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _CenterChip extends StatelessWidget {
  const _CenterChip({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 150,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE8EEF7)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 22),
            const Spacer(),
            Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, fontSize: 11.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({required this.service});

  final ServiceModel service;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SectionCard(
        onTap: () => context.push(AppRoutes.serviceDetail(service.id)),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.badge_outlined, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    service.name,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${service.duration} min • ${service.category}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}

class _ActiveRequestCard extends StatelessWidget {
  const _ActiveRequestCard({required this.appointment});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      onTap: () => context.push(AppRoutes.appointmentDetail(appointment.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  appointment.reference,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
              StatusChip(status: appointment.status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            appointment.serviceName.isEmpty
                ? appointment.requestTypeLabel
                : appointment.serviceName,
            style: const TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (appointment.isTrackable)
                Expanded(
                  child: OutlinedButton(
                    onPressed: () =>
                        context.push(AppRoutes.trackRef(appointment.reference)),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
                    child: const Text('Track'),
                  ),
                ),
              if (appointment.isTrackable) const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () => context.push(AppRoutes.ticket(appointment.reference)),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 42)),
                  child: const Text('QR ticket'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
