import '../../core/utils/json_utils.dart';

/// Response of the OTP request endpoints
/// (`/api/otp/request`, `/api/otp/forgot-password/request`, login OTP resend).
class OtpSession {
  const OtpSession({
    required this.otpId,
    required this.phone,
    required this.purpose,
    this.expiresIn = 300,
    this.retryAfter = 60,
    this.message = '',
    this.deliveryStatus = '',
    this.deliveryMessage = '',
    this.devOtp = '',
    this.userId,
    this.loginToken,
  });

  final String otpId;
  final String phone;
  final String purpose;
  final int expiresIn;
  final int retryAfter;
  final String message;
  final String deliveryStatus;
  final String deliveryMessage;
  final String devOtp;

  /// Present on the forgot-password flow so the reset call can identify the user.
  final String? userId;

  /// Present on the login OTP flow (`otpRequired: true`).
  final String? loginToken;

  OtpSession copyWith({String? otpId, String? loginToken}) => OtpSession(
    otpId: otpId ?? this.otpId,
    phone: phone,
    purpose: purpose,
    expiresIn: expiresIn,
    retryAfter: retryAfter,
    message: message,
    deliveryStatus: deliveryStatus,
    deliveryMessage: deliveryMessage,
    devOtp: devOtp,
    userId: userId,
    loginToken: loginToken ?? this.loginToken,
  );

  factory OtpSession.fromJson(
    Map<String, dynamic> json, {
    String? fallbackPurpose,
  }) => OtpSession(
    otpId: Json.str(json['otpId']),
    phone: Json.str(json['phone']),
    purpose: Json.str(json['purpose'], fallbackPurpose ?? ''),
    expiresIn: Json.intOf(json['expiresIn'], 300),
    retryAfter: Json.intOf(json['retryAfter'], 60),
    message: Json.str(json['message']),
    deliveryStatus: Json.str(json['deliveryStatus']),
    deliveryMessage: Json.str(json['deliveryMessage']),
    devOtp: Json.str(json['devOtp']),
    userId: Json.strOrNull(json['userId']),
    loginToken: Json.strOrNull(json['loginToken']),
  );
}
