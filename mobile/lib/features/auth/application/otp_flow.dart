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
    this.resumeToken,
    this.redirectTo,
  });

  final OtpMode mode;
  final OtpSession session;

  /// Username or phone typed on the previous screen, needed by the
  /// forgot-password verify call.
  final String? identifier;

  final String? title;
  final String? subtitle;

  /// Carried over from the Login screen (only relevant for [OtpMode.login])
  /// so the citizen lands back on whatever protected action or page they
  /// were trying to reach once the OTP step also succeeds.
  final String? resumeToken;
  final String? redirectTo;

  OtpArgs copyWith({OtpSession? session}) => OtpArgs(
        mode: mode,
        session: session ?? this.session,
        identifier: identifier,
        title: title,
        subtitle: subtitle,
        resumeToken: resumeToken,
        redirectTo: redirectTo,
      );
}
