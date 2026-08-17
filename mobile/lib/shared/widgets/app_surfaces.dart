import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Theme-aware palette helpers. Every citizen tab paints the same surfaces so
/// light and dark mode never mix inside one screen.
class AppSurface {
  const AppSurface._();

  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color background(BuildContext context) =>
      isDark(context) ? AppColors.darkBackground : AppColors.lightBackground;

  static Color card(BuildContext context) =>
      isDark(context) ? AppColors.darkSurface : Colors.white;

  static Color border(BuildContext context) =>
      isDark(context) ? AppColors.darkBorder : AppColors.lightBorder;

  static Color ink(BuildContext context) =>
      isDark(context) ? const Color(0xFFF1F5F9) : AppColors.ink;

  static Color muted(BuildContext context) =>
      isDark(context) ? const Color(0xFF9AA6B8) : AppColors.muted;

  static Color brand(BuildContext context) =>
      isDark(context) ? AppColors.accentSoft : AppColors.primary;

  /// Background for the small coloured icon squares used on every tab.
  static Color tint(BuildContext context, Color base) =>
      base.withValues(alpha: isDark(context) ? 0.22 : 0.12);
}

/// The header every bottom-tab screen starts with: drawer button, page title
/// and optional actions. Tabs render inside the shell body, so this also
/// absorbs the status bar inset that an [AppBar] would normally handle.
class TabHeader extends StatelessWidget {
  const TabHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.onMenu,
    this.actions = const <Widget>[],
  });

  final String title;
  final String subtitle;
  final VoidCallback? onMenu;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 4),
      child: Row(
        children: [
          IconButton(
            onPressed: onMenu,
            icon: Icon(Icons.menu_rounded, color: AppSurface.ink(context)),
            tooltip: 'Menu',
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppSurface.brand(context),
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                        letterSpacing: -0.2,
                      ),
                ),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppSurface.muted(context),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                ),
              ],
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}

/// Bell action with the unread badge, shared by Home and Services.
class HeaderBellButton extends StatelessWidget {
  const HeaderBellButton({super.key, required this.unread, required this.onTap});

  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: 'Alerts',
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

/// Plain icon action for headers that are not the notification bell.
class HeaderIconButton extends StatelessWidget {
  const HeaderIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(icon, color: AppSurface.ink(context)),
    );
  }
}

/// The flat, bordered card the Home screen uses. Kept deliberately lighter
/// than a Material [Card] so lists of them stay readable on small screens.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.onTap,
    this.radius = 16,
    this.color,
    this.borderColor,
    this.borderWidth = 1,
    this.tintColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;
  final Color? color;
  final Color? borderColor;
  final double borderWidth;

  /// Soft background/border tint for icon-led service or action cards, so
  /// the card itself carries a hint of color instead of leaving it confined
  /// to the icon badge. Ignored when [color]/[borderColor] are set directly.
  final Color? tintColor;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    final tint = tintColor;
    return Material(
      color: color ??
          (tint != null
              ? tint.withValues(alpha: AppSurface.isDark(context) ? 0.16 : 0.08)
              : AppSurface.card(context)),
      borderRadius: shape,
      child: InkWell(
        onTap: onTap,
        borderRadius: shape,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: shape,
            border: Border.all(
              color: borderColor ??
                  (tint != null
                      ? tint.withValues(alpha: 0.28)
                      : AppSurface.border(context)),
              width: borderWidth,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(
                  alpha: AppSurface.isDark(context) ? 0.22 : 0.04,
                ),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Section title with an optional trailing text action ("View All").
class AppSectionTitle extends StatelessWidget {
  const AppSectionTitle({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppSurface.ink(context),
                  fontWeight: FontWeight.w700,
                  fontSize: 16.5,
                ),
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.info,
              padding: const EdgeInsets.symmetric(horizontal: 8),
            ),
            child: Text(
              actionLabel!,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.info,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
      ],
    );
  }
}

/// The 34x34 rounded icon square repeated across stats, actions and lists.
class SoftIconBadge extends StatelessWidget {
  const SoftIconBadge({
    super.key,
    required this.icon,
    required this.color,
    this.size = 34,
    this.background,
  });

  final IconData icon;
  final Color color;
  final double size;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background ?? AppSurface.tint(context, color),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: Icon(icon, color: color, size: size * 0.53),
    );
  }
}

/// Standard list padding for a tab: status bar handled by [TabHeader], bottom
/// padding clears the floating bottom navigation bar.
EdgeInsets tabListPadding(BuildContext context) => EdgeInsets.fromLTRB(
  16,
  8,
  16,
  24 + MediaQuery.paddingOf(context).bottom + 72,
);
