import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/models/service.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../home/application/protected_action.dart';
import '../../home/presentation/home_shell.dart';
import '../../notifications/application/notifications_controller.dart';
import '../data/service_repository.dart';

enum _ServiceFilter { all, mostUsed, available }

class ServicesScreen extends ConsumerStatefulWidget {
  const ServicesScreen({super.key});

  @override
  ConsumerState<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends ConsumerState<ServicesScreen> {
  String _query = '';
  _ServiceFilter _filter = _ServiceFilter.all;

  @override
  Widget build(BuildContext context) {
    final services = ref.watch(servicesProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    return Scaffold(
      backgroundColor: AppSurface.background(context),
      body: services.when(
        loading: () => const LoadingView(message: 'Loading services'),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(servicesProvider),
        ),
        data: (all) {
          final active = all.where((service) => service.isActive).toList();
          final completedRegistration = ref.watch(
            completedNewRegistrationProvider,
          );
          final activeNewRegistration = ref.watch(
            activeNewRegistrationProvider,
          );
          final items = _serviceMenuItems(
            context,
            active,
            completedRegistration,
            activeNewRegistration,
          );
          final filtered = items.where((item) {
            if (_query.isNotEmpty) {
              final q = _query.toLowerCase();
              final matchesQuery = item.title.toLowerCase().contains(q) ||
                  item.subtitle.toLowerCase().contains(q);
              if (!matchesQuery) return false;
            }
            switch (_filter) {
              case _ServiceFilter.available:
                return item.available;
              case _ServiceFilter.mostUsed:
                return item.selected;
              case _ServiceFilter.all:
                return true;
            }
          }).toList();
          final featured = filtered.where((item) => item.selected).toList();
          final rest = filtered.where((item) => !item.selected).toList();

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(servicesProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: tabListPadding(context),
              children: [
                TabHeader(
                  title: 'Services',
                  subtitle: 'Choose a service',
                  onMenu: () => HomeShellScope.maybeOf(context)?.openDrawer(),
                  actions: [
                    HeaderBellButton(
                      unread: unread,
                      onTap: () =>
                          _runGated(context, ref, ProtectedAction.notifications),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                _SearchBox(
                  onChanged: (value) =>
                      setState(() => _query = value.trim().toLowerCase()),
                ),
                const SizedBox(height: 14),
                _FilterTabs(
                  value: _filter,
                  onChanged: (value) => setState(() => _filter = value),
                ),
                const SizedBox(height: 18),
                if (filtered.isEmpty)
                  EmptyStateView(
                    icon: Icons.search_off_rounded,
                    title: _query.isEmpty
                        ? 'No services available'
                        : 'No services match "$_query"',
                    message: _query.isEmpty
                        ? 'Published National ID services will appear here.'
                        : 'Try a different search term.',
                  )
                else ...[
                  for (final item in featured) ...[
                    _FeaturedServiceCard(item: item),
                    const SizedBox(height: 14),
                  ],
                  if (rest.isNotEmpty)
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.88,
                      children: [
                        for (final item in rest) _CompactServiceCard(item: item),
                      ],
                    ),
                ],
                if (filtered.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.15),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.location_city_rounded,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Need to visit a center? Some services require an in-person visit.',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.navy,
                              fontSize: 12.5,
                              height: 1.3,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: () => context.go(AppRoutes.centers),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(0, 34),
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            textStyle: const TextStyle(fontSize: 12.5),
                          ),
                          child: const Text('Find Centers'),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  List<ServiceMenuItem> _serviceMenuItems(
    BuildContext context,
    List<ServiceModel> services,
    Object? completedRegistration,
    Object? activeNewRegistration,
  ) {
    final newRegistration = _findService(services, RequestTypes.newNationalId);
    final updateInfo = _findService(services, RequestTypes.updateInformation);
    final lostId = _findService(services, RequestTypes.lostReplacement);

    return [
      ServiceMenuItem(
        title: 'New Registration',
        subtitle: activeNewRegistration != null
            ? 'View your open request and submitted details.'
            : 'Apply for your first National ID.',
        icon: Icons.badge_outlined,
        color: AppColors.primary,
        selected: true,
        available: newRegistration != null,
        lockedReason: 'Not available right now.',
        onTap: () => _runGated(context, ref, ProtectedAction.newRegistration),
      ),
      ServiceMenuItem(
        title: 'Update Information',
        subtitle: 'Correct or update your National ID information.',
        icon: Icons.manage_accounts_outlined,
        color: const Color(0xFF16A34A),
        available: updateInfo != null && completedRegistration != null,
        lockedReason: 'Opens after New Registration is completed.',
        onTap: () => _runGated(context, ref, ProtectedAction.updateInformation),
      ),
      ServiceMenuItem(
        title: 'Lost ID Replacement',
        subtitle: 'Replace your lost or damaged National ID.',
        icon: Icons.file_copy_outlined,
        color: const Color(0xFFD97706),
        available: lostId != null && completedRegistration != null,
        lockedReason: 'Opens after New Registration is completed.',
        onTap: () => _runGated(context, ref, ProtectedAction.lostReplacement),
      ),
    ];
  }

  ServiceModel? _findService(List<ServiceModel> services, String requestType) {
    for (final service in services) {
      if (service.requestType == requestType) return service;
    }
    return null;
  }

  void _runGated(BuildContext context, WidgetRef ref, ProtectedAction action) {
    if (!ensureSignedIn(context, ref, action)) return;
    runProtectedAction(context, ref, action);
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(26),
      borderSide: BorderSide(color: AppSurface.border(context)),
    );

    return TextField(
      onChanged: onChanged,
      style: TextStyle(color: AppSurface.ink(context)),
      decoration: InputDecoration(
        hintText: 'Search services',
        hintStyle: TextStyle(color: AppSurface.muted(context)),
        prefixIcon: Icon(
          Icons.search_rounded,
          color: AppSurface.muted(context),
        ),
        filled: true,
        fillColor: AppSurface.card(context),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 16,
        ),
        border: border,
        enabledBorder: border,
      ),
    );
  }
}

/// "All / Most Used / Available" pill row above the service list. Most Used
/// is the primary, always-open service ([ServiceMenuItem.selected]) since
/// this app has no real usage-frequency data to rank by.
class _FilterTabs extends StatelessWidget {
  const _FilterTabs({required this.value, required this.onChanged});

  final _ServiceFilter value;
  final ValueChanged<_ServiceFilter> onChanged;

  static const _options = [
    (filter: _ServiceFilter.all, label: 'All'),
    (filter: _ServiceFilter.mostUsed, label: 'Most Used'),
    (filter: _ServiceFilter.available, label: 'Available'),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final option in _options) ...[
            _FilterPill(
              label: option.label,
              selected: value == option.filter,
              onTap: () => onChanged(option.filter),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppSurface.card(context),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: selected ? AppColors.primary : AppSurface.border(context),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : AppSurface.ink(context),
          ),
        ),
      ),
    );
  }
}

class ServiceMenuItem {
  const ServiceMenuItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
    this.selected = false,
    this.available = true,
    this.lockedReason,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool selected;
  final bool available;

  /// Shown in place of [subtitle] when [available] is false, so the reason
  /// a service is locked is still visible without a separate badge.
  final String? lockedReason;
}

/// Large full-width card for the primary/most-used service.
class _FeaturedServiceCard extends StatelessWidget {
  const _FeaturedServiceCard({required this.item});

  final ServiceMenuItem item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: item.onTap,
      padding: const EdgeInsets.all(18),
      tintColor: item.color,
      radius: 20,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SoftIconBadge(icon: item.icon, color: item.color, size: 44),
                const SizedBox(height: 14),
                Text(
                  item.title,
                  style: TextStyle(
                    color: AppSurface.ink(context),
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  item.available
                      ? item.subtitle
                      : (item.lockedReason ?? item.subtitle),
                  style: TextStyle(
                    color: item.available
                        ? AppSurface.muted(context)
                        : AppColors.warning,
                    fontSize: 13,
                    height: 1.35,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 16),
                _ServiceActionButton(
                  label: item.available ? 'Apply Now' : 'Locked',
                  color: item.color,
                  filled: true,
                  onTap: item.onTap,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _FeaturedIllustration(icon: item.icon, color: item.color),
        ],
      ),
    );
  }
}

/// Soft icon-in-circle graphic that stands in for a hand-drawn illustration,
/// built from the existing icon set so the redesign needs no new art assets.
class _FeaturedIllustration extends StatelessWidget {
  const _FeaturedIllustration({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 78,
      height: 78,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(
                alpha: AppSurface.isDark(context) ? 0.22 : 0.14,
              ),
            ),
          ),
          Icon(icon, size: 40, color: color.withValues(alpha: 0.85)),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(shape: BoxShape.circle, color: color),
              child: const Icon(
                Icons.check_rounded,
                size: 13,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Smaller grid card used for every non-featured service.
class _CompactServiceCard extends StatelessWidget {
  const _CompactServiceCard({required this.item});

  final ServiceMenuItem item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: item.onTap,
      padding: const EdgeInsets.all(14),
      tintColor: item.color,
      radius: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SoftIconBadge(icon: item.icon, color: item.color, size: 38),
              if (!item.available)
                Icon(
                  Icons.lock_outline_rounded,
                  size: 16,
                  color: AppSurface.muted(context),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            item.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppSurface.ink(context),
              fontSize: 14.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: Text(
              item.available
                  ? item.subtitle
                  : (item.lockedReason ?? item.subtitle),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: item.available
                    ? AppSurface.muted(context)
                    : AppColors.warning,
                fontSize: 11,
                height: 1.3,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 10),
          _ServiceActionButton(
            label: item.available ? 'Open' : 'Locked',
            color: item.color,
            onTap: item.onTap,
          ),
        ],
      ),
    );
  }
}

class _ServiceActionButton extends StatelessWidget {
  const _ServiceActionButton({
    required this.label,
    required this.color,
    required this.onTap,
    this.filled = false,
  });

  final String label;
  final Color color;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800)),
        const SizedBox(width: 4),
        const Icon(Icons.arrow_forward_rounded, size: 14),
      ],
    );

    if (filled) {
      return SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: onTap,
          style: FilledButton.styleFrom(
            backgroundColor: color,
            foregroundColor: Colors.white,
            minimumSize: const Size(0, 42),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: child,
        ),
      );
    }

    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: 0.5)),
        minimumSize: const Size(0, 34),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
      ),
      child: child,
    );
  }
}
