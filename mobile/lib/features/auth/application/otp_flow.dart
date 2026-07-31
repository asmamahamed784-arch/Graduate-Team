import '../../../shared/models/otp_session.dart';

/// The three places an SMS code is required.
enum OtpMode {
  /// Second factor on `POST /api/auth/login` when the backend asks for it.
  login,

  /// `POST /api/otp/forgot-password/*` before a password reset.
  forgotPassword,

  /// `POST /api/otp/request` before creating a booking or a request.
  booking,
}

/// Arguments handed to the shared OTP screen through `go_router`'s `extra`.
class OtpArgs {
  const OtpArgs({
    required this.mode,
    required this.session,
    this.identifier,
    this.title,
    this.subtitle,
  });

  final OtpMode mode;
  final OtpSession session;

  /// Username or phone typed on the previous screen, needed by the
  /// forgot-password verify call.
  final String? identifier;

  final String? title;
  final String? subtitle;

  OtpArgs copyWith({OtpSession? session}) => OtpArgs(
        mode: mode,
        session: session ?? this.session,
        identifier: identifier,
        title: title,
        subtitle: subtitle,
      );
}
