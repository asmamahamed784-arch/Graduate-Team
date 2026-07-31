import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/router/role_home.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/auth_controller.dart';
import '../application/otp_flow.dart';
import 'widgets/auth_scaffold.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscure = true;
  bool _remember = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _restoreRememberedUsername();
  }

  Future<void> _restoreRememberedUsername() async {
    final saved = await ref.read(tokenStorageProvider).readRememberedUsername();
    if (saved != null && mounted) {
      _identifierController.text = saved;
    }
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await ref.read(authControllerProvider.notifier).login(
            identifier: _identifierController.text,
            password: _passwordController.text,
            rememberUsername: _remember,
          );
      if (!mounted) return;

      if (result.needsOtp) {
        context.push(
          AppRoutes.verifyOtp,
          extra: OtpArgs(
            mode: OtpMode.login,
            session: result.otpSession!,
            identifier: _identifierController.text.trim(),
            title: 'Confirm it is you',
            subtitle: 'Enter the code we sent to your registered phone.',
          ),
        );
        return;
      }

      // Route by backend role only (never by username).
      final user = ref.read(authControllerProvider).user;
      final destination = homeRouteForUser(user);
      debugPrint('[NQS LOGIN] role=${user?.role} isAdmin=${user?.isAdmin} -> $destination');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Signed in as ${user?.role ?? 'unknown'} → opening ${user?.isAdmin == true ? 'Admin' : user?.isOperator == true ? 'Operator' : 'Citizen'} dashboard',
          ),
          duration: const Duration(seconds: 3),
        ),
      );
      context.go(destination);
    } on ApiException catch (error) {
      if (!mounted) return;
      final offlineHint = error.isOffline ? '\n(API: ${Env.apiBaseUrl})' : '';
      setState(() => _error = '${error.message}$offlineHint');
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Welcome back',
      subtitle: 'Sign in to book appointments and follow your National ID requests.',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              InlineErrorBanner(message: _error!),
              const SizedBox(height: 18),
            ],
            TextFormField(
              controller: _identifierController,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Username or phone number',
              ),
              validator: (value) => (value ?? '').trim().isEmpty
                  ? 'Enter your username or phone number.'
                  : null,
            ),
            const SizedBox(height: 18),
            TextFormField(
              controller: _passwordController,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'Password',
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: AppColors.muted,
                  ),
                ),
              ),
              validator: (value) =>
                  (value ?? '').isEmpty ? 'Enter your password.' : null,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                SizedBox(
                  height: 24,
                  width: 24,
                  child: Checkbox(
                    value: _remember,
                    activeColor: AppColors.navy,
                    side: const BorderSide(color: AppColors.muted),
                    onChanged: (value) => setState(() => _remember = value ?? false),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => setState(() => _remember = !_remember),
                  child: const Text(
                    'Remember me',
                    style: TextStyle(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => context.push(AppRoutes.forgotPassword),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.accent,
                    padding: EdgeInsets.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Forgot password?',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            SizedBox(
              height: 54,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF00234B),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFF00234B).withValues(alpha: 0.6),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Sign in'),
              ),
            ),
            const SizedBox(height: 22),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text(
                  'New to NQS? ',
                  style: TextStyle(color: AppColors.muted, fontSize: 14),
                ),
                TextButton(
                  onPressed: () => context.push(AppRoutes.register),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.accent,
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Create an account',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
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
