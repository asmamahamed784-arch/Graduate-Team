import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../data/otp_repository.dart';
import 'widgets/auth_scaffold.dart';

/// Carries the short-lived `verificationToken` produced by the OTP verify step.
class ResetPasswordArgs {
  const ResetPasswordArgs({
    required this.verificationToken,
    this.phone,
    this.userId,
  });

  final String verificationToken;
  final String? phone;
  final String? userId;
}

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, this.args});

  final ResetPasswordArgs? args;

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _obscure = true;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final args = widget.args;
    if (args == null) {
      setState(() => _error = 'This reset link has expired. Please start again.');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref.read(otpRepositoryProvider).resetPassword(
            password: _passwordController.text,
            verificationToken: args.verificationToken,
            phone: args.phone,
            userId: args.userId,
          );
      if (!mounted) return;
      showAppSnackBar(context, 'Password updated. You can sign in now.');
      context.go(AppRoutes.login);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      showBack: true,
      title: 'Set a new password',
      subtitle: 'Choose a strong password you have not used before.',
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
              controller: _passwordController,
              obscureText: _obscure,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: 'New password',
                helperText: Validators.passwordRule,
                helperMaxLines: 2,
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  ),
                ),
              ),
              validator: Validators.password,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _confirmController,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: const InputDecoration(
                labelText: 'Confirm new password',
                prefixIcon: Icon(Icons.lock_reset_rounded),
              ),
              validator: (value) =>
                  Validators.confirmPassword(value, _passwordController.text),
            ),
            const SizedBox(height: 24),
            PrimaryButton(
              label: 'Update password',
              loading: _submitting,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
