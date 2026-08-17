import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../appointments/application/booking_draft.dart';
import '../../appointments/presentation/booking_success_screen.dart';
import '../../home/application/protected_action.dart';
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
  ConsumerState<OtpVerificationScreen> createState() =>
      _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _digitControllers = List.generate(6, (_) => TextEditingController());
  final _digitFocusNodes = List.generate(6, (_) => FocusNode());

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
    for (final controller in _digitControllers) {
      controller.dispose();
    }
    for (final focusNode in _digitFocusNodes) {
      focusNode.dispose();
    }
    super.dispose();
  }

  String get _otpCode =>
      _digitControllers.map((controller) => controller.text).join();

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
    final validationError = Validators.otpCode(_otpCode);
    if (validationError != null) {
      setState(() => _error = validationError);
      _digitFocusNodes.first.requestFocus();
      return;
    }
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
    await ref
        .read(authControllerProvider.notifier)
        .completeLoginOtp(
          loginToken: _args.session.loginToken ?? '',
          otpId: _args.session.otpId,
          code: _otpCode,
        );
    if (!mounted) return;
    await resumeAfterAuth(
      context,
      ref,
      resumeToken: _args.resumeToken,
      redirectTo: _args.redirectTo,
    );
  }

  Future<void> _verifyPasswordReset() async {
    final token = await ref
        .read(otpRepositoryProvider)
        .verifyPasswordReset(
          identifier: _args.identifier ?? _args.session.phone,
          code: _otpCode,
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
      setState(
        () => _error = 'The booking session expired. Please start again.',
      );
      return;
    }

    // Prefer the phone used when the OTP was requested (booking form).
    // Profile phone may be empty after registration without a phone number.
    final phone = draft.phone.trim().isNotEmpty
        ? draft.phone
        : _args.session.phone;

    final otpToken = await ref
        .read(otpRepositoryProvider)
        .verify(
          purpose: _args.session.purpose,
          code: _otpCode,
          otpId: _args.session.otpId,
          phone: phone,
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
        OtpMode.login =>
          await ref
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
      _clearOtpCode();
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

  void _clearOtpCode() {
    for (final controller in _digitControllers) {
      controller.clear();
    }
    _digitFocusNodes.first.requestFocus();
  }

  void _updateDigit(int index, String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      _digitControllers[index].clear();
      if (index > 0) _digitFocusNodes[index - 1].requestFocus();
      return;
    }

    if (digits.length > 1) {
      final chars = digits.split('').take(6).toList();
      for (var i = 0; i < _digitControllers.length; i++) {
        _digitControllers[i].text = i < chars.length ? chars[i] : '';
      }
      final focusIndex = chars.length >= 6 ? 5 : chars.length;
      _digitFocusNodes[focusIndex].requestFocus();
    } else {
      _digitControllers[index].text = digits;
      if (index < _digitFocusNodes.length - 1) {
        _digitFocusNodes[index + 1].requestFocus();
      }
    }

    if (_otpCode.length == 6) _verify();
  }

  @override
  Widget build(BuildContext context) {
    final phone = Formatters.maskedPhone(_args.session.phone);

    return PopScope(
      canPop: _args.mode != OtpMode.login,
      child: AuthScaffold(
        showBack: true,
        title: _args.title ?? 'OTP Verification',
        subtitle: _args.subtitle ?? 'Enter the 6-digit code we sent to $phone.',
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                InlineErrorBanner(message: _error!),
                const SizedBox(height: 18),
              ],
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  'Code sent to $phone',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.navy,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (_args.session.devOtp.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFF97316)),
                  ),
                  child: Text(
                    'SMS failed, use this OTP: ${_args.session.devOtp}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF9A3412),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 18),
              LayoutBuilder(
                builder: (context, constraints) {
                  final gap = constraints.maxWidth < 360 ? 6.0 : 8.0;
                  final boxWidth = ((constraints.maxWidth - (gap * 5)) / 6)
                      .clamp(40.0, 52.0);

                  return Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(6, (index) {
                      return Padding(
                        padding: EdgeInsets.only(right: index == 5 ? 0 : gap),
                        child: SizedBox(
                          width: boxWidth,
                          height: 54,
                          child: TextFormField(
                            controller: _digitControllers[index],
                            focusNode: _digitFocusNodes[index],
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            autofocus: index == 0,
                            maxLength: 1,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: AppColors.navy,
                            ),
                            decoration: InputDecoration(
                              counterText: '',
                              contentPadding: EdgeInsets.zero,
                              filled: true,
                              fillColor: Colors.white,
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: AppColors.primary.withValues(
                                    alpha: 0.28,
                                  ),
                                  width: 1.4,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(
                                  color: AppColors.primary,
                                  width: 2,
                                ),
                              ),
                            ),
                            onChanged: (value) => _updateDigit(index, value),
                            onFieldSubmitted: (_) => _verify(),
                          ),
                        ),
                      );
                    }),
                  );
                },
              ),
              const SizedBox.shrink(),
              /*
                offstage: true,
                child: TextFormField(
                controller: _digitControllers.first,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                autofocus: true,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 14,
                  color: AppColors.navy,
                ),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: '• • • • • •',
                  hintStyle: TextStyle(
                    color: AppColors.muted.withValues(alpha: 0.5),
                    letterSpacing: 10,
                  ),
                ),
                validator: (_) => null,
                onChanged: (value) {
                  if (value.length == 6) _verify();
                },
                onFieldSubmitted: (_) => _verify(),
              ),
              */
              const SizedBox(height: 10),
              Text(
                _secondsLeft > 0
                    ? 'Resend available in ${_secondsLeft}s'
                    : 'Didn’t get the code?',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 18),
              PrimaryButton(
                label: 'Verify',
                loading: _submitting,
                onPressed: _verify,
              ),
              const SizedBox(height: 12),
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
                              ? 'Resend OTP in ${_secondsLeft}s'
                              : 'Resend OTP',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
              ),
              if (_args.mode == OtpMode.booking)
                TextButton(
                  onPressed: () => context.pop(),
                  child: const Text('Change phone number'),
                ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  'Code expires in ${(_args.session.expiresIn / 60).ceil()} minutes. Invalid or expired codes cannot be used.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
