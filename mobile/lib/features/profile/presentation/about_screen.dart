import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/nqs_page_header.dart';
import '../../home/application/protected_action.dart';
import '../../notifications/application/notifications_controller.dart';

/// Mission/Vision copy mirrors the web app's real About page
/// (`frontend/src/pages/About.jsx`) so both surfaces tell the same story.
class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  static const _coreValues = [
    'Integrity',
    'Efficiency',
    'Transparency',
    'Respect',
    'Innovation',
  ];

  static const _keyFeatures = [
    (
      icon: Icons.event_available_rounded,
      color: AppColors.info,
      title: 'Online Appointment Booking',
      subtitle: 'Book appointments for National ID services easily.',
      action: ProtectedAction.newRegistration,
    ),
    (
      icon: Icons.groups_2_rounded,
      color: AppColors.success,
      title: 'Live Queue Tracking',
      subtitle: 'Track your queue status in real time.',
      action: ProtectedAction.trackQueue,
    ),
    (
      icon: Icons.location_city_rounded,
      color: Color(0xFF7C3AED),
      title: 'Multiple Service Centers',
      subtitle: 'Access services at multiple National ID centers.',
      action: null,
    ),
    (
      icon: Icons.notifications_rounded,
      color: AppColors.warning,
      title: 'Instant Notifications',
      subtitle: 'Get real-time updates about your appointments.',
      action: ProtectedAction.notifications,
    ),
    (
      icon: Icons.shield_rounded,
      color: AppColors.danger,
      title: 'Secure & Reliable',
      subtitle: 'Your data and information are safe with us.',
      action: null,
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadNotificationCountProvider);

    return Scaffold(
      backgroundColor: AppSurface.background(context),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: [
          NqsPageHeader(
            icon: Icons.info_rounded,
            iconColor: AppColors.primary,
            title: 'About NQS',
            subtitle: 'Learn about the National Queueing System',
            onMenu: () => Navigator.of(context).maybePop(),
            bell: NqsHeaderBell(
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
          ),
          const SizedBox(height: 18),
          const _HeroBrandCard(),
          const SizedBox(height: 18),
          AppCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SoftIconBadge(
                  icon: Icons.info_outline_rounded,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'About the System',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                          color: AppSurface.ink(context),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'NQS is designed to improve the way citizens access National '
                        'Identification services by reducing waiting times, improving '
                        'organization, and ensuring a transparent and efficient service '
                        'delivery process.',
                        style: TextStyle(
                          color: AppSurface.muted(context),
                          fontSize: 12.5,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const _SectionHeader(
            icon: Icons.star_rounded,
            color: AppColors.success,
            title: 'Vision and Mission',
          ),
          const SizedBox(height: 10),
          const _ExpandableInfoCard(
            icon: Icons.visibility_rounded,
            title: 'Vision',
            body:
                'To become the leading digital platform for National ID '
                'service delivery, setting a new standard for speed, trust '
                'and citizen experience.',
          ),
          const SizedBox(height: 10),
          const _ExpandableInfoCard(
            icon: Icons.track_changes_rounded,
            title: 'Mission',
            body:
                'To provide accessible, secure and efficient National ID '
                'services through digital appointments, transparent queues, '
                'and reliable center support for every citizen.',
          ),
          const SizedBox(height: 22),
          const _SectionHeader(
            icon: Icons.diamond_rounded,
            color: AppColors.primary,
            title: 'Core Values',
          ),
          const SizedBox(height: 10),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < _coreValues.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: 56),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          color: AppColors.primary,
                          size: 22,
                        ),
                        const SizedBox(width: 14),
                        Text(
                          _coreValues[i],
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: AppSurface.ink(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 22),
          const _SectionHeader(
            icon: Icons.bookmark_rounded,
            color: AppColors.warning,
            title: 'Key Features',
          ),
          const SizedBox(height: 10),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < _keyFeatures.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: 62),
                  _FeatureRow(feature: _keyFeatures[i]),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroBrandCard extends StatelessWidget {
  const _HeroBrandCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.navyDark],
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 92,
            height: 92,
            padding: const EdgeInsets.all(14),
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
            ),
            child: Image.asset(
              'assets/images/crest.png',
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Icon(
                Icons.shield_rounded,
                color: AppColors.navy,
                size: 42,
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'NQS',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 24,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'National Queueing System',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.color,
    required this.title,
  });

  final IconData icon;
  final Color color;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SoftIconBadge(icon: icon, color: color, size: 30),
        const SizedBox(width: 10),
        Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 15.5,
            color: AppSurface.ink(context),
          ),
        ),
      ],
    );
  }
}

/// Tappable header bar that reveals its body text — mirrors the collapsible
/// Vision/Mission cards this screen's redesign was matched against.
class _ExpandableInfoCard extends StatefulWidget {
  const _ExpandableInfoCard({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  State<_ExpandableInfoCard> createState() => _ExpandableInfoCardState();
}

class _ExpandableInfoCardState extends State<_ExpandableInfoCard> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Material(
        color: AppSurface.card(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Container(
                color: AppColors.primary,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    Icon(widget.icon, color: Colors.white, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        widget.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                        ),
                      ),
                    ),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: Colors.white,
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: AppColors.primary.withValues(alpha: 0.25),
                      width: 2,
                    ),
                  ),
                ),
                child: Text(
                  widget.body,
                  style: TextStyle(
                    color: AppSurface.muted(context),
                    fontSize: 12.5,
                    height: 1.45,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _FeatureRow extends ConsumerWidget {
  const _FeatureRow({required this.feature});

  final ({
    IconData icon,
    Color color,
    String title,
    String subtitle,
    ProtectedAction? action,
  })
  feature;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final action = feature.action;
    return InkWell(
      onTap: action == null
          ? null
          : () {
              if (!ensureSignedIn(context, ref, action)) return;
              runProtectedAction(context, ref, action);
            },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            SoftIconBadge(icon: feature.icon, color: feature.color, size: 38),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    feature.title,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13.5,
                      color: AppSurface.ink(context),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    feature.subtitle,
                    style: TextStyle(
                      color: AppSurface.muted(context),
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
            if (action != null)
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
