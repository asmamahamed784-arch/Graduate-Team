import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/otp_flow.dart';
import '../data/otp_repository.dart';
import 'widgets/auth_scaffold.dart';

/// Step one of the reset supported by the backend:
/// `POST /api/otp/forgot-password/request`.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _identifierController.dispose();
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
      final session = await ref.read(otpRepositoryProvider).requestPasswordReset(
            identifier: _identifierController.text,
          );
      if (!mounted) return;
      context.push(
        AppRoutes.verifyOtp,
        extra: OtpArgs(
          mode: OtpMode.forgotPassword,
          session: session,
          identifier: _identifierController.text.trim(),
          title: 'Reset your password',
          subtitle: 'Enter the code we sent to your registered phone number.',
        ),
      );
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
      title: 'Forgot password',
      subtitle: 'We will send a verification code to the phone number on your account.',
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
              autocorrect: false,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              decoration: const InputDecoration(
                labelText: 'Username or phone number',
                prefixIcon: Icon(Icons.person_search_outlined),
              ),
              validator: (value) => (value ?? '').trim().isEmpty
                  ? 'Enter your username or phone number.'
                  : null,
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Send code',
              loading: _submitting,
              onPressed: _submit,
            ),
            const SizedBox(height: 18),
            Center(
              child: TextButton(
                onPressed: () => context.pop(),
                child: Text(
                  'Back to sign in',
                  style: TextStyle(color: AppColors.muted),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
