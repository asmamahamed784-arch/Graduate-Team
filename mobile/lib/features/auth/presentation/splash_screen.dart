import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../application/auth_controller.dart';

/// Off-white splash -> Login once startup auth resolves.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  bool _navigated = false;
  final _startedAt = DateTime.now();

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _goNext() async {
    if (_navigated || !mounted) return;
    final auth = ref.read(authControllerProvider);
    if (auth.isResolving) return;

    final elapsed = DateTime.now().difference(_startedAt);
    const minSplash = Duration(milliseconds: 2200);
    if (elapsed < minSplash) {
      await Future<void>.delayed(minSplash - elapsed);
    }
    if (!mounted || _navigated) return;
    _navigated = true;

    context.go(auth.isAuthenticated ? AppRoutes.home : AppRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (_, next) {
      if (!next.isResolving) unawaited(_goNext());
    });

    final auth = ref.watch(authControllerProvider);
    if (!auth.isResolving && !_navigated) {
      WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_goNext()));
    }

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 3),
            ScaleTransition(
              scale: Tween<double>(begin: 0.96, end: 1.04).animate(
                CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
              ),
              child: Container(
                width: 104,
                height: 104,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.16),
                      blurRadius: 28,
                      offset: const Offset(0, 12),
                    ),
                  ],
                  border: Border.all(color: AppColors.primarySoft, width: 2),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Image.asset(
                    'assets/images/crest.png',
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => const Icon(
                      Icons.shield_rounded,
                      color: AppColors.navy,
                      size: 52,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'NQS National ID',
              style: TextStyle(
                color: AppColors.navy,
                fontSize: 28,
                fontWeight: FontWeight.w900,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Citizens Portal',
              style: TextStyle(
                color: AppColors.primary.withValues(alpha: 0.9),
                fontSize: 14,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.6,
              ),
            ),
            const Spacer(flex: 2),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.6,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Loading…',
              style: TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }
}
