import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/router/role_home.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../appointments/application/booking_draft.dart';
import '../../appointments/presentation/booking_success_screen.dart';
import '../application/auth_controller.dart';
import '../application/otp_flow.dart';
import '../data/auth_repository.dart';
import '../data/otp_repository.dart';
import 'reset_password_screen.dart';
import 'widgets/auth_scaffold.dart';

/// One screen for all three OTP flows: login second factor, password reset,
/// and the code that gates every new booking.
class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key, required this.args});

  final OtpArgs args;

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();

  late OtpArgs _args = widget.args;
  Timer? _timer;
  int _secondsLeft = 0;
  bool _submitting = false;
  bool _resending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startCountdown(_args.session.retryAfter);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _codeController.dispose();
    super.dispose();
  }

  void _startCountdown(int seconds) {
    _timer?.cancel();
    setState(() => _secondsLeft = seconds);
    if (seconds <= 0) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _secondsLeft -= 1);
      if (_secondsLeft <= 0) timer.cancel();
    });
  }

  Future<void> _verify() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      switch (_args.mode) {
        case OtpMode.login:
          await _verifyLogin();
        case OtpMode.forgotPassword:
          await _verifyPasswordReset();
        case OtpMode.booking:
          await _verifyBooking();
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _verifyLogin() async {
    await ref.read(authControllerProvider.notifier).completeLoginOtp(
          loginToken: _args.session.loginToken ?? '',
          otpId: _args.session.otpId,
          code: _codeController.text,
        );
    if (!mounted) return;
    final user = ref.read(authControllerProvider).user;
    context.go(homeRouteForUser(user));
  }

  Future<void> _verifyPasswordReset() async {
    final token = await ref.read(otpRepositoryProvider).verifyPasswordReset(
          identifier: _args.identifier ?? _args.session.phone,
          code: _codeController.text,
          otpId: _args.session.otpId,
          phone: _args.session.phone,
          userId: _args.session.userId,
        );
    if (!mounted) return;
    context.pushReplacement(
      AppRoutes.resetPassword,
      extra: ResetPasswordArgs(
        verificationToken: token,
        phone: _args.session.phone,
        userId: _args.session.userId,
      ),
    );
  }

  Future<void> _verifyBooking() async {
    final draft = ref.read(bookingDraftProvider);
    if (draft == null) {
      setState(() => _error = 'The booking session expired. Please start again.');
      return;
    }

    final otpToken = await ref.read(otpRepositoryProvider).verify(
          purpose: _args.session.purpose,
          code: _codeController.text,
          otpId: _args.session.otpId,
        );

    final appointment = await ref
        .read(appointmentsControllerProvider.notifier)
        .submitDraft(draft, otpToken);

    ref.read(bookingDraftProvider.notifier).clear();
    if (!mounted) return;
    context.pushReplacement(
      AppRoutes.bookingSuccess,
      extra: BookingSuccessArgs(appointment: appointment),
    );
  }

  Future<void> _resend() async {
    if (_secondsLeft > 0 || _resending) return;
    setState(() {
      _resending = true;
      _error = null;
    });

    try {
      final otp = ref.read(otpRepositoryProvider);
      final session = switch (_args.mode) {
        OtpMode.login => await ref
            .read(authRepositoryProvider)
            .resendLoginOtp(_args.session.loginToken ?? ''),
        OtpMode.forgotPassword => await otp.requestPasswordReset(
            identifier: _args.identifier ?? _args.session.phone,
            resend: true,
            phone: _args.session.phone,
          ),
        OtpMode.booking => await otp.request(
            purpose: _args.session.purpose,
            phone: _args.session.phone,
            resend: true,
          ),
      };

      if (!mounted) return;
      setState(() => _args = _args.copyWith(session: session));
      _startCountdown(session.retryAfter);
      showAppSnackBar(context, 'A new code has been sent.');
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
        final retry = error.retryAfter;
        if (retry != null) _startCountdown(retry);
      }
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final phone = Formatters.maskedPhone(_args.session.phone);

    return PopScope(
      canPop: _args.mode != OtpMode.login,
      child: AuthScaffold(
        showBack: true,
        title: _args.title ?? 'Verify your phone',
        subtitle: _args.subtitle ?? 'We sent a 6-digit code to $phone.',
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                InlineErrorBanner(message: _error!),
                const SizedBox(height: 18),
              ],
              Text(
                'Enter the code sent to $phone',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                autofocus: true,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 12,
                ),
                decoration: const InputDecoration(
                  counterText: '',
                  hintText: '------',
                ),
                validator: Validators.otpCode,
                onFieldSubmitted: (_) => _verify(),
              ),
              const SizedBox(height: 20),
              PrimaryButton(
                label: 'Verify',
                loading: _submitting,
                onPressed: _verify,
              ),
              const SizedBox(height: 16),
              Center(
                child: _resending
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : TextButton(
                        onPressed: _secondsLeft > 0 ? null : _resend,
                        child: Text(
                          _secondsLeft > 0
                              ? 'Resend code in ${_secondsLeft}s'
                              : 'Resend code',
                        ),
                      ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'The code expires in ${(_args.session.expiresIn / 60).round()} minutes.',
                  style: TextStyle(color: AppColors.muted, fontSize: 12.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
