import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/state_views.dart';
import '../../home/application/protected_action.dart';
import '../application/auth_controller.dart';
import '../application/otp_flow.dart';
import 'widgets/nqs_auth_page.dart';

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

  String _friendlyLoginError(ApiException error) {
    final raw = error.message.toLowerCase();
    if (raw.contains('disabled') || raw.contains('inactive')) {
      return 'Account disabled. Contact National ID support.';
    }
    if (raw.contains('password') &&
        (raw.contains('incorrect') ||
            raw.contains('invalid') ||
            raw.contains('wrong'))) {
      return 'Incorrect PIN. Please try again.';
    }
    if (raw.contains('user') ||
        raw.contains('username') ||
        raw.contains('not found') ||
        raw.contains('credentials')) {
      return 'Incorrect User ID or PIN.';
    }
    if (error.isOffline) {
      return '${error.message}\n(API: ${Env.apiBaseUrl})';
    }
    return error.message;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _submitting = true;
      _error = null;
    });

    final query = GoRouterState.of(context).uri.queryParameters;
    final resumeToken = query['resume'];
    final redirectTo = query['redirectTo'];

    try {
      final result = await ref.read(authControllerProvider.notifier).login(
            identifier: _identifierController.text,
            password: _passwordController.text,
            rememberUsername: true,
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
            resumeToken: resumeToken,
            redirectTo: redirectTo,
          ),
        );
        return;
      }

      await resumeAfterAuth(context, ref, resumeToken: resumeToken, redirectTo: redirectTo);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyLoginError(error));
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return NqsAuthPage(
      heading: 'Welcome Back!',
      subheading: 'Please sign in to continue',
      bottomArt: const NqsWaveArt(),
      footer: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          InkWell(
            onTap: () => context.push(AppRoutes.help),
            borderRadius: BorderRadius.circular(10),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.support_agent_rounded, color: AppColors.primary, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Need help?',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              InlineErrorBanner(message: _error!),
              const SizedBox(height: 16),
            ],
            TextFormField(
              controller: _identifierController,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'User ID',
                hintText: 'Enter your User ID',
                prefixIcon: Icon(Icons.person_outline_rounded),
              ),
              validator: (value) => (value ?? '').trim().isEmpty
                  ? 'Enter your User ID.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _passwordController,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'PIN',
                hintText: 'Enter your PIN',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: AppColors.muted,
                  ),
                ),
              ),
              validator: (value) =>
                  (value ?? '').isEmpty ? 'Enter your PIN.' : null,
            ),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.push(AppRoutes.forgotPassword),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  padding: EdgeInsets.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Forgot PIN?',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 54,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.navy,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.navy.withValues(alpha: 0.55),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
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
                    : const Text('Sign In'),
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text(
                  "Don't have an account? ",
                  style: TextStyle(color: AppColors.muted, fontSize: 13.5),
                ),
                TextButton(
                  onPressed: () {
                    final query = GoRouterState.of(context).uri.queryParameters;
                    context.push(
                      Uri(path: AppRoutes.register, queryParameters: {
                        if (query['resume'] != null) 'resume': query['resume'],
                        if (query['redirectTo'] != null)
                          'redirectTo': query['redirectTo'],
                      }).toString(),
                    );
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Create Account',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
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
