import 'package:flutter/material.dart';

import '../../core/constants/app_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../features/auth/presentation/widgets/nqs_auth_page.dart';
import 'app_surfaces.dart';

/// Two-tier header shared by every main tab screen: a slim NQS brand bar
/// (hamburger, crest, wordmark, notification bell) followed by a colored
/// icon badge with the page title and subtitle.
class NqsPageHeader extends StatelessWidget {
  const NqsPageHeader({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.onMenu,
    this.bell,
    this.trailing,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback? onMenu;
  final Widget? bell;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                onPressed: onMenu,
                icon: Icon(Icons.menu_rounded, color: AppSurface.ink(context)),
                tooltip: 'Menu',
              ),
              const NqsCrest(size: 26),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'NQS',
                      style: TextStyle(
                        color: AppSurface.brand(context),
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                        height: 1,
                      ),
                    ),
                    Text(
                      AppConstants.appTagline,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppSurface.muted(context),
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (bell != null) bell!,
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              SoftIconBadge(icon: icon, color: iconColor, size: 38),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: AppSurface.ink(context),
                        fontWeight: FontWeight.w900,
                        fontSize: 21,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: AppSurface.muted(context),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ],
      ),
    );
  }
}

/// Bell icon + unread badge, styled to sit in [NqsPageHeader]'s brand row.
class NqsHeaderBell extends StatelessWidget {
  const NqsHeaderBell({super.key, required this.unread, required this.onTap});

  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: 'Notifications',
      icon: Badge(
        isLabelVisible: unread > 0,
        backgroundColor: AppColors.danger,
        label: Text('$unread'),
        child: Icon(
          Icons.notifications_none_rounded,
          color: AppSurface.ink(context),
        ),
      ),
    );
  }
}
