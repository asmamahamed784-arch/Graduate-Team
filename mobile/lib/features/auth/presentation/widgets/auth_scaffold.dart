import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';

/// Light citizens-portal auth shell matching the NQS login / create-account mockups.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
    this.showBack = false,
    this.brandTitle = 'NQS National ID',
    this.brandSubtitle = 'CITIZENS PORTAL',
    this.footer,
    this.titleCentered = false,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final bool showBack;
  final String brandTitle;
  final String brandSubtitle;
  final Widget? footer;
  final bool titleCentered;

  /// Primary navy used across login / register.
  static const Color brandBlue = AppColors.navy;
  static const Color _bgTop = Color(0xFFEAF2FF);
  static const Color _bgBottom = Color(0xFFF7F9FC);

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final topPad = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: _bgBottom,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [_bgTop, Colors.white, _bgBottom],
                    stops: [0, 0.45, 1],
                  ),
                ),
              ),
            ),
            const Positioned.fill(child: CustomPaint(painter: _DotGridPainter())),
            ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: ClampingScrollPhysics(),
              ),
              padding: EdgeInsets.fromLTRB(20, topPad + 8, 20, 28 + bottomInset),
              children: [
                SizedBox(
                  height: 48,
                  child: showBack
                      ? Align(
                          alignment: Alignment.centerLeft,
                          child: Material(
                            color: Colors.white,
                            shape: const CircleBorder(),
                            elevation: 1.5,
                            shadowColor: Colors.black26,
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () => Navigator.of(context).maybePop(),
                              child: const SizedBox(
                                width: 42,
                                height: 42,
                                child: Icon(
                                  Icons.arrow_back_rounded,
                                  color: Color(0xFF1E293B),
                                  size: 22,
                                ),
                              ),
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
                const SizedBox(height: 4),
                Center(
                  child: Column(
                    children: [
                      Container(
                        width: 78,
                        height: 78,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: brandBlue.withValues(alpha: 0.12),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Text(
                          'NQS',
                          style: TextStyle(
                            color: brandBlue,
                            fontWeight: FontWeight.w900,
                            fontSize: 22,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        brandTitle,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: brandBlue,
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        brandSubtitle,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.muted.withValues(alpha: 0.9),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 2.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 26),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.navy.withValues(alpha: 0.08),
                        blurRadius: 28,
                        offset: const Offset(0, 14),
                      ),
                    ],
                  ),
                  child: Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: Theme.of(context).colorScheme.copyWith(
                        primary: brandBlue,
                      ),
                      inputDecorationTheme: InputDecorationTheme(
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 16,
                        ),
                        hintStyle: TextStyle(
                          color: AppColors.muted.withValues(alpha: 0.75),
                          fontWeight: FontWeight.w500,
                          fontStyle: FontStyle.italic,
                          fontSize: 14,
                        ),
                        labelStyle: const TextStyle(
                          color: Color(0xFF334155),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        prefixIconColor: brandBlue,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFD7E0EC)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFD7E0EC)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: brandBlue,
                            width: 1.6,
                          ),
                        ),
                        errorBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppColors.danger),
                        ),
                        focusedErrorBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: AppColors.danger,
                            width: 1.4,
                          ),
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          title,
                          textAlign:
                              titleCentered ? TextAlign.center : TextAlign.start,
                          style: const TextStyle(
                            color: brandBlue,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          subtitle,
                          textAlign:
                              titleCentered ? TextAlign.center : TextAlign.start,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 13.5,
                            height: 1.4,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 22),
                        child,
                        if (footer != null) ...[
                          const SizedBox(height: 18),
                          footer!,
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: const BoxDecoration(
                        color: brandBlue,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.verified_user_rounded,
                        color: Colors.white,
                        size: 14,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Your information is secure with NQS.',
                      style: TextStyle(
                        color: AppColors.muted.withValues(alpha: 0.95),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DotGridPainter extends CustomPainter {
  const _DotGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.navy.withValues(alpha: 0.06)
      ..style = PaintingStyle.fill;

    const spacing = 18.0;
    // Soft wave of dots on the upper-right, matching the mockups.
    for (var y = 24.0; y < size.height * 0.42; y += spacing) {
      for (var x = size.width * 0.55; x < size.width - 8; x += spacing) {
        final t = (x / size.width) + (y / size.height);
        if (t < 0.9) {
          canvas.drawCircle(Offset(x, y), 1.35, paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
