import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/models/center.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/presentation/widgets/nqs_auth_page.dart';
import '../../centers/data/center_repository.dart';
import '../../notifications/application/notifications_controller.dart';
import '../application/protected_action.dart';
import '../data/public_stats_repository.dart';
import 'home_shell.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    final auth = ref.read(authControllerProvider);
    ref.invalidate(publicHomeStatsProvider);
    if (!auth.isAuthenticated) return;
    await Future.wait([
      ref.read(authControllerProvider.notifier).refreshProfile(),
      ref.read(appointmentsControllerProvider.notifier).refresh(),
      ref.read(notificationsControllerProvider.notifier).refresh(),
    ]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadNotificationCountProvider);
    final appointments = ref.watch(appointmentsControllerProvider);
    final currentAppointment = ref.watch(currentAppointmentProvider);

    var stagger = 0;
    Widget animated(Widget child) =>
        _FadeSlideIn(index: stagger++, child: child);

    return ColoredBox(
      color: AppSurface.background(context),
      child: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => _refresh(ref),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: tabListPadding(context),
          children: [
            _HomeHeader(unread: unread),
            const SizedBox(height: 18),
            animated(const _HeroSlider()),
            const SizedBox(height: 18),
            AppSectionTitle(
              title: 'Services',
              actionLabel: 'View all',
              onAction: () => context.go(AppRoutes.services),
            ),
            const SizedBox(height: 12),
            animated(_ServicesGrid(unread: unread)),
            const SizedBox(height: 16),
            animated(
              _AppointmentStatusCard(
                loading: appointments.isLoading,
                appointment: currentAppointment,
              ),
            ),
            const SizedBox(height: 14),
            animated(
              _StatusChipsRow(appointments: appointments.value ?? const []),
            ),
            const SizedBox(height: 22),
            const AppSectionTitle(title: 'Facts & Figures'),
            const SizedBox(height: 10),
            animated(const _FactsAndFigures()),
            const SizedBox(height: 22),
            AppSectionTitle(
              title: 'Nearby Centers',
              actionLabel: 'View all',
              onAction: () => context.go(AppRoutes.centers),
            ),
            const SizedBox(height: 10),
            animated(const _NearbyCentersCard()),
          ],
        ),
      ),
    );
  }
}

/// Subtle fade + slide-up entrance, staggered by [index] so Home's sections
/// cascade in on first load instead of popping in all at once.
class _FadeSlideIn extends StatelessWidget {
  const _FadeSlideIn({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 420 + (index * 60).clamp(0, 240)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 16),
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}

class _HomeHeader extends ConsumerWidget {
  const _HomeHeader({required this.unread});

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
          const NqsCrest(size: 42),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'NQS National ID',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppSurface.brand(context),
                fontWeight: FontWeight.w800,
                fontSize: 23,
              ),
            ),
          ),
          HeaderBellButton(
            unread: unread,
            onTap: () {
              if (!ensureSignedIn(
                context,
                ref,
                ProtectedAction.notifications,
              )) {
                return;
              }
              context.go(AppRoutes.notifications);
            },
          ),
        ],
      ),
    );
  }
}

class _HeroSlider extends StatefulWidget {
  const _HeroSlider();

  @override
  State<_HeroSlider> createState() => _HeroSliderState();
}

class _HeroSliderState extends State<_HeroSlider> {
  final _controller = PageController();
  int _page = 0;
  Timer? _autoAdvance;

  /// Same six slides, images and captions as the web app's Home hero
  /// carousel (`frontend/src/pages/Home.jsx`) â€” kept in sync so mobile and
  /// web tell the same story with the same real photos.
  static const _slides = [
    (
      image: 'assets/images/hero_service_center.png',
      title: 'Your ID, Your Right, Your Future',
      subtitle:
          'Apply for your National ID, update your information, or replace a lost card.',
    ),
    (
      image: 'assets/images/hero_slide_office.png',
      title: 'Professional Service, Closer to You',
      subtitle:
          'Modern registration centers with trusted staff and clear guidance.',
    ),
    (
      image: 'assets/images/hero_slide_mobile.png',
      title: 'National ID Services in Your Pocket',
      subtitle:
          'Book appointments, follow updates, and manage requests from anywhere.',
    ),
    (
      image: 'assets/images/hero_digital.png',
      title: 'Identity. Dignity. Future.',
      subtitle:
          'Secure digital identity services connecting citizens with trusted centers.',
    ),
    (
      image: 'assets/images/hero_slide_devices.png',
      title: 'One Platform for Every Citizen',
      subtitle:
          'Track your queue in real time and complete services with confidence.',
    ),
    (
      image: 'assets/images/hero_slide_booking.png',
      title: 'Book Online, Skip the Wait',
      subtitle:
          'Choose your service, pick a date, and manage your appointment online.',
    ),
  ];

  static const _slideDuration = Duration(seconds: 7);

  @override
  void initState() {
    super.initState();
    _autoAdvance = Timer.periodic(_slideDuration, (_) {
      if (!mounted || !_controller.hasClients) return;
      final next = (_page + 1) % _slides.length;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 550),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _autoAdvance?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: SizedBox(
            height: 178,
            child: PageView.builder(
              controller: _controller,
              onPageChanged: (i) => setState(() => _page = i),
              itemCount: _slides.length,
              itemBuilder: (context, i) {
                final slide = _slides[i];
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      slide.image,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const ColoredBox(color: AppColors.navy),
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          stops: const [0.4, 1],
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.72),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 16,
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 320),
                        transitionBuilder: (child, animation) => FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: Tween<Offset>(
                              begin: const Offset(0, 0.15),
                              end: Offset.zero,
                            ).animate(animation),
                            child: child,
                          ),
                        ),
                        child: Column(
                          key: ValueKey(i),
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              slide.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 17,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              slide.subtitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < _slides.length; i++)
              GestureDetector(
                onTap: () => _controller.animateToPage(
                  i,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeInOutCubic,
                ),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOut,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: _page == i ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _page == i
                        ? AppColors.primary
                        : AppColors.primary.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _ServicesGrid extends StatelessWidget {
  const _ServicesGrid({required this.unread});

  final int unread;

  @override
  Widget build(BuildContext context) {
    final tiles =
        <
          ({
            String label,
            IconData icon,
            Color color,
            ProtectedAction action,
            int badge,
          })
        >[
          (
            label: 'New Registration',
            icon: Icons.badge_outlined,
            color: const Color(0xFF2563EB),
            action: ProtectedAction.newRegistration,
            badge: 0,
          ),
          (
            label: 'Update Information',
            icon: Icons.manage_accounts_outlined,
            color: const Color(0xFF168B53),
            action: ProtectedAction.updateInformation,
            badge: 0,
          ),
          (
            label: 'Lost ID Replacement',
            icon: Icons.file_copy_outlined,
            color: const Color(0xFFD97706),
            action: ProtectedAction.lostReplacement,
            badge: 0,
          ),
          (
            label: 'Notifications',
            icon: Icons.notifications_outlined,
            color: const Color(0xFFDC2626),
            action: ProtectedAction.notifications,
            badge: unread,
          ),
          (
            label: 'Track Queue',
            icon: Icons.groups_2_outlined,
            color: const Color(0xFF8B5CF6),
            action: ProtectedAction.trackQueue,
            badge: 0,
          ),
        ];

    return Column(
      children: [
        Row(
          children: [
            for (var i = 0; i < 3; i++) ...[
              if (i > 0) const SizedBox(width: 12),
              Expanded(child: _ServiceTile(tile: tiles[i], height: 134)),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _ServiceTile(tile: tiles[3], height: 118)),
            const SizedBox(width: 12),
            Expanded(child: _ServiceTile(tile: tiles[4], height: 118)),
          ],
        ),
      ],
    );
  }
}

class _ServiceTile extends ConsumerWidget {
  const _ServiceTile({required this.tile, required this.height});

  final ({
    String label,
    IconData icon,
    Color color,
    ProtectedAction action,
    int badge,
  })
  tile;
  final double height;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      height: height,
      child: AppCard(
        radius: 15,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        tintColor: tile.color,
        onTap: () {
          if (!ensureSignedIn(context, ref, tile.action)) return;
          runProtectedAction(context, ref, tile.action);
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Badge(
              isLabelVisible: tile.badge > 0,
              label: Text('${tile.badge}'),
              child: SoftIconBadge(
                icon: tile.icon,
                color: tile.color,
                size: 38,
              ),
            ),
            const SizedBox(height: 7),
            Flexible(
              child: Text(
                tile.label,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppSurface.ink(context),
                  fontSize: 11.8,
                  fontWeight: FontWeight.w800,
                  height: 1.12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AppointmentStatusCard extends StatelessWidget {
  const _AppointmentStatusCard({
    required this.loading,
    required this.appointment,
  });

  final bool loading;
  final Appointment? appointment;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const AppCard(
        padding: EdgeInsets.symmetric(vertical: 26),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
      );
    }

    final a = appointment;
    if (a == null) {
      return AppCard(
        onTap: () => context.go(AppRoutes.services),
        child: Row(
          children: [
            SoftIconBadge(
              icon: Icons.confirmation_num_outlined,
              color: AppColors.info,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                'No active appointment. Book a National ID service to see it here.',
                style: TextStyle(
                  color: AppSurface.muted(context),
                  fontSize: 12.8,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: AppSurface.muted(context)),
          ],
        ),
      );
    }

    final queueNumber = a.queueNumber.isNotEmpty
        ? a.queueNumber
        : a.ticketNumber;
    final appointmentText = a.hasAppointmentSlot
        ? [
            Formatters.readableDate(a.date),
            if (a.timeSlot != null) a.timeSlot!,
          ].join(' • ')
        : '--';
    final status = a.status.isEmpty
        ? 'Scheduled'
        : Formatters.titleCase(a.status);

    return AppCard(
      radius: 18,
      padding: const EdgeInsets.all(12),
      onTap: () => context.push(AppRoutes.appointmentDetail(a.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'My Appointment Status',
                  style: TextStyle(
                    color: AppSurface.ink(context),
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Text(
                'View details',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _StatusInfoBox(
            child: Row(
              children: [
                SoftIconBadge(
                  icon: Icons.calendar_month_outlined,
                  color: AppColors.primary,
                  size: 42,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Row(
                    children: [
                      Expanded(
                        child: _TinyStatusField(
                          label: 'Ticket No.',
                          value: a.reference.isEmpty ? '--' : a.reference,
                        ),
                      ),
                      const _MiniDivider(),
                      Expanded(
                        child: _TinyStatusField(
                          label: 'Queue No.',
                          value: queueNumber.isEmpty ? '--' : queueNumber,
                          valueColor: AppColors.primary,
                        ),
                      ),
                      const _MiniDivider(),
                      Expanded(
                        child: _TinyStatusField(
                          label: 'Service',
                          value: a.serviceName.isEmpty
                              ? a.requestTypeLabel
                              : a.serviceName,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          _StatusInfoBox(
            child: Row(
              children: [
                Expanded(
                  child: _TinyStatusField(
                    label: 'Center',
                    value: a.centerName.isEmpty ? '--' : a.centerName,
                  ),
                ),
                const _MiniDivider(),
                Expanded(
                  child: _TinyStatusField(
                    label: 'Appointment',
                    value: appointmentText,
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(child: _StatusPill(label: status)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusInfoBox extends StatelessWidget {
  const _StatusInfoBox({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppSurface.isDark(context)
            ? Colors.white.withValues(alpha: 0.04)
            : const Color(0xFFF8FBFF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppSurface.border(context)),
      ),
      child: child,
    );
  }
}

class _TinyStatusField extends StatelessWidget {
  const _TinyStatusField({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppSurface.muted(context),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: valueColor ?? AppSurface.ink(context),
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            height: 1.12,
          ),
        ),
      ],
    );
  }
}

class _MiniDivider extends StatelessWidget {
  const _MiniDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 34,
      margin: const EdgeInsets.symmetric(horizontal: 10),
      color: AppSurface.border(context),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: AppColors.primary,
          fontSize: 11.5,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _StatusChipsRow extends StatelessWidget {
  const _StatusChipsRow({required this.appointments});

  final List<Appointment> appointments;

  @override
  Widget build(BuildContext context) {
    final withSlot = appointments.where((a) => a.hasAppointmentSlot).toList();
    final waiting = withSlot
        .where(
          (a) =>
              a.status == TicketStatus.waiting ||
              a.status == TicketStatus.beingServed,
        )
        .length;
    final completed = withSlot
        .where(
          (a) =>
              a.requestStatus.toLowerCase() == 'completed' ||
              a.status.toLowerCase() == 'completed',
        )
        .length;
    final upcoming = withSlot
        .where(
          (a) =>
              a.isActive &&
              !a.isCancelled &&
              a.status != TicketStatus.waiting &&
              a.status != TicketStatus.beingServed &&
              a.requestStatus.toLowerCase() != 'completed',
        )
        .length;

    final items = [
      (waiting, 'Waiting', Icons.schedule_rounded, AppColors.warning),
      (
        completed,
        'Completed',
        Icons.check_circle_outline_rounded,
        AppColors.success,
      ),
      (upcoming, 'Upcoming', Icons.event_available_outlined, AppColors.info),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(
            child: AppCard(
              radius: 14,
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Column(
                children: [
                  SoftIconBadge(icon: items[i].$3, color: items[i].$4),
                  const SizedBox(height: 8),
                  Text(
                    '${items[i].$1}',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 17,
                      color: AppSurface.ink(context),
                    ),
                  ),
                  Text(
                    items[i].$2,
                    style: TextStyle(
                      color: AppSurface.muted(context),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _FactsAndFigures extends ConsumerWidget {
  const _FactsAndFigures();

  String _compact(int value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M+';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K+';
    return '$value';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(publicHomeStatsProvider);
    final data = stats.asData?.value ?? PublicHomeStats.empty;

    final items = [
      (
        _compact(data.registeredCitizens),
        'Registered Users',
        Icons.groups_2_rounded,
        const Color(0xFF2563EB),
      ),
      (
        _compact(data.serviceCenters),
        'Service Centers',
        Icons.location_city_rounded,
        AppColors.success,
      ),
      (
        _compact(data.appointmentsBooked),
        'Appointments Booked',
        Icons.event_note_rounded,
        const Color(0xFF7C3AED),
      ),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(
            child: AppCard(
              radius: 14,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
              tintColor: items[i].$4,
              child: Column(
                children: [
                  SoftIconBadge(icon: items[i].$3, color: items[i].$4),
                  const SizedBox(height: 8),
                  stats.isLoading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          items[i].$1,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            color: AppSurface.ink(context),
                          ),
                        ),
                  const SizedBox(height: 3),
                  Text(
                    items[i].$2,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppSurface.muted(context),
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      height: 1.15,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _NearbyCentersCard extends ConsumerWidget {
  const _NearbyCentersCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final centers = ref.watch(centersProvider).value ?? const <CenterModel>[];

    if (centers.isEmpty) {
      return const _NearbyCenterTile(center: null);
    }

    return Column(
      children: [
        for (var i = 0; i < centers.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          _NearbyCenterTile(center: centers[i]),
        ],
      ],
    );
  }
}

class _NearbyCenterTile extends StatelessWidget {
  const _NearbyCenterTile({required this.center});

  final CenterModel? center;

  @override
  Widget build(BuildContext context) {
    final item = center;
    final name = item?.name.trim().isNotEmpty == true
        ? item!.name
        : 'NQS City Center';
    final location = item?.location.trim().isNotEmpty == true
        ? item!.location
        : '123 Independence Avenue, Capital City';
    final hours = item?.hoursLabel.trim().isNotEmpty == true
        ? item!.hoursLabel
        : 'Mon - Fri: 8:00 AM - 4:30 PM';

    return AppCard(
      radius: 17,
      padding: const EdgeInsets.all(10),
      onTap: () {
        if (item != null) {
          context.push(AppRoutes.centerDetail(item.id));
        } else {
          context.go(AppRoutes.centers);
        }
      },
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.asset(
              'assets/images/hero_service_center.png',
              width: 82,
              height: 64,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 82,
                height: 64,
                color: AppSurface.tint(context, AppColors.primary),
                child: const Icon(Icons.location_city_rounded),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppSurface.ink(context),
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                _CenterMetaLine(icon: Icons.place_outlined, text: location),
                const SizedBox(height: 4),
                _CenterMetaLine(icon: Icons.schedule_rounded, text: hours),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppSurface.tint(context, AppColors.muted),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '1.2 km',
              style: TextStyle(
                color: AppSurface.muted(context),
                fontWeight: FontWeight.w800,
                fontSize: 12,
              ),
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: AppSurface.muted(context)),
        ],
      ),
    );
  }
}

class _CenterMetaLine extends StatelessWidget {
  const _CenterMetaLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppSurface.muted(context)),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            text,
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
