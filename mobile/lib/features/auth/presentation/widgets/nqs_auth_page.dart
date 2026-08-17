import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Crest shown at the top of Login/Register. Drop the real artwork at
/// `assets/images/crest.png` (already declared in pubspec.yaml) — until then
/// this falls back to a plain shield glyph instead of guessing at the design.
class NqsCrest extends StatelessWidget {
  const NqsCrest({super.key, this.size = 118});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/crest.png',
      height: size,
      width: size,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) => Container(
        height: size,
        width: size,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.primarySoft,
          shape: BoxShape.circle,
        ),
        child: Icon(
          Icons.shield_rounded,
          size: size * 0.5,
          color: AppColors.navy,
        ),
      ),
    );
  }
}

/// Crest + "NQS" wordmark + "National Queueing System" tagline, shared by
/// the Login and Create Account screens.
class NqsBrandHeader extends StatelessWidget {
  const NqsBrandHeader({super.key, this.crestSize = 118});

  final double crestSize;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        NqsCrest(size: crestSize),
        const SizedBox(height: 10),
        const Text(
          'NQS',
          style: TextStyle(
            fontSize: 34,
            fontWeight: FontWeight.w900,
            color: AppColors.navy,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'National Queueing System',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.navy.withValues(alpha: 0.72),
          ),
        ),
      ],
    );
  }
}

/// Plain-background auth page shell shared by Login and Register: optional
/// back/title bar, brand header, a heading pair, the form, an optional
/// footer link and a soft decorative shape pinned to the bottom.
class NqsAuthPage extends StatelessWidget {
  const NqsAuthPage({
    super.key,
    this.appBarTitle,
    this.showBack = false,
    required this.heading,
    required this.subheading,
    required this.child,
    this.footer,
    this.bottomArt,
  });

  final String? appBarTitle;
  final bool showBack;
  final String heading;
  final String subheading;
  final Widget child;
  final Widget? footer;
  final Widget? bottomArt;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFD),
      appBar: appBarTitle == null
          ? null
          : AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              centerTitle: true,
              leading: showBack
                  ? IconButton(
                      icon: const Icon(
                        Icons.chevron_left_rounded,
                        color: AppColors.navy,
                        size: 30,
                      ),
                      onPressed: () => Navigator.of(context).maybePop(),
                    )
                  : null,
              title: Text(
                appBarTitle!,
                style: const TextStyle(
                  color: AppColors.navy,
                  fontWeight: FontWeight.w800,
                  fontSize: 19,
                ),
              ),
            ),
      body: Stack(
        children: [
          if (bottomArt != null)
            Positioned(left: 0, right: 0, bottom: 0, child: bottomArt!),
          SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(26, 22, 26, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const NqsBrandHeader(),
                  const SizedBox(height: 26),
                  Text(
                    heading,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 25,
                      fontWeight: FontWeight.w900,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subheading,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 26),
                  child,
                  if (footer != null) ...[const SizedBox(height: 20), footer!],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Soft wave pinned to the bottom of the Login screen.
class NqsWaveArt extends StatelessWidget {
  const NqsWaveArt({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ClipPath(
        clipper: _WaveClipper(),
        child: Container(
          height: 90,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFFDCEBFF), Color(0xFFF1F6FF)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ),
    );
  }
}

class _WaveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path()..lineTo(0, size.height * 0.4);
    path.quadraticBezierTo(
      size.width * 0.25,
      size.height * 0.95,
      size.width * 0.5,
      size.height * 0.55,
    );
    path.quadraticBezierTo(
      size.width * 0.75,
      size.height * 0.15,
      size.width,
      size.height * 0.6,
    );
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// Soft city-skyline silhouette pinned to the bottom of the Register screen.
class NqsSkylineArt extends StatelessWidget {
  const NqsSkylineArt({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: SizedBox(
        height: 64,
        width: double.infinity,
        child: CustomPaint(painter: _SkylinePainter()),
      ),
    );
  }
}

class _SkylinePainter extends CustomPainter {
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
    final paint = Paint()..color = const Color(0xFFE3ECFB);
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
