/// Every path the citizen mobile app calls on the existing NQS backend.
/// Paths mirror `backend/routes/*.js` exactly and must not be invented.
/// Staff-only endpoints (admin, operators, sessions, reports, audits) are
/// deliberately absent: those screens live in the web portal.
class ApiEndpoints {
  const ApiEndpoints._();

  // Auth
  static const String register = '/api/auth/register';
  static const String login = '/api/auth/login';
  static const String loginOtpVerify = '/api/auth/login/otp/verify';
  static const String loginOtpResend = '/api/auth/login/otp/resend';
  static const String logout = '/api/auth/logout';
  static const String profile = '/api/auth/profile';
  static const String changePassword = '/api/auth/password';

  // OTP
  static const String otpRequest = '/api/otp/request';
  static const String otpVerify = '/api/otp/verify';
  static const String forgotPasswordRequest = '/api/otp/forgot-password/request';
  static const String forgotPasswordVerify = '/api/otp/forgot-password/verify';
  static const String forgotPasswordReset = '/api/otp/forgot-password/reset';

  // Catalogue
  static const String services = '/api/services';
  static String service(String id) => '/api/services/$id';
  static const String centers = '/api/centers';
  static String center(String id) => '/api/centers/$id';

  // Bookings
  static const String bookings = '/api/bookings';
  static const String myBookings = '/api/bookings/my';
  static const String bookingAvailability = '/api/bookings/availability';
  static String booking(String refOrId) => '/api/bookings/$refOrId';
  static String cancelBooking(String id) => '/api/bookings/$id/cancel';
  static String resubmitBooking(String id) => '/api/bookings/$id/resubmit';

  // Queue tracking
  static String trackTicket(String ref) => '/api/queue/track/$ref';
  static String liveQueue(String centerId) => '/api/queue/live/$centerId';

  // Notifications
  static const String notifications = '/api/notifications';
  static const String notificationsReadAll = '/api/notifications/read-all';
  static String notificationRead(String id) => '/api/notifications/$id/read';
  static String notification(String id) => '/api/notifications/$id';

  // QR ticket
  static const String qrGenerate = '/api/qr/generate';

  // Public, no-auth stats shown on the guest-facing Home screen.
  static const String publicHomeStats = '/api/reports/public-home-stats';

  // Contact form
  static const String contact = '/api/contact';
}
