/// Every path the mobile app calls on the existing NQS backend.
/// Paths mirror `backend/routes/*.js` exactly and must not be invented.
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
  static const String adminBookings = '/api/bookings/admin/all';
  static String booking(String refOrId) => '/api/bookings/$refOrId';
  static String cancelBooking(String id) => '/api/bookings/$id/cancel';
  static String resubmitBooking(String id) => '/api/bookings/$id/resubmit';
  static String adminBookingStatus(String id) => '/api/bookings/admin/$id/status';
  static String adminBookingRequestStatus(String id) =>
      '/api/bookings/admin/$id/request-status';
  static String adminBookingReplacementStatus(String id) =>
      '/api/bookings/admin/$id/replacement-status';
  static String adminBookingCorrection(String id) => '/api/bookings/admin/$id/correction';

  // Queue / operator
  static const String queueList = '/api/queue/list';
  static const String queueCallNext = '/api/queue/call-next';
  static const String operatorCallNext = '/api/operator/call-next';
  static const String operatorDashboard = '/api/operator/dashboard';
  static const String operatorQueue = '/api/operator/queue';
  static String queueHold(String id) => '/api/queue/$id/hold';
  static String queueComplete(String id) => '/api/queue/$id/complete';
  static String operatorComplete(String ticketId) => '/api/operator/complete/$ticketId';
  static String trackTicket(String ref) => '/api/queue/track/$ref';
  static String liveQueue(String centerId) => '/api/queue/live/$centerId';

  // Reports / admin
  static const String reportStats = '/api/reports/stats';
  static const String reportAnalytics = '/api/reports/analytics';
  static const String operatorDashboardReport = '/api/reports/operator-dashboard';

  // Users / operators
  static const String users = '/api/users';
  static String user(String id) => '/api/users/$id';
  static String userStatus(String id) => '/api/users/$id/status';
  static String userResetPassword(String id) => '/api/users/$id/reset-password';
  static const String operators = '/api/operators';
  static String operator(String id) => '/api/operators/$id';
  static String operatorApprove(String id) => '/api/operators/$id/approve';
  static String operatorReject(String id) => '/api/operators/$id/reject';
  static String operatorActivate(String id) => '/api/operators/$id/activate';
  static String operatorDeactivate(String id) => '/api/operators/$id/deactivate';

  // Sessions / activity / audits
  static const String sessions = '/api/sessions';
  static String invalidateSession(String id) => '/api/sessions/$id/invalidate';
  static const String activities = '/api/activities';
  static const String audits = '/api/audits';

  // Notifications
  static const String notifications = '/api/notifications';
  static const String notificationsReadAll = '/api/notifications/read-all';
  static String notificationRead(String id) => '/api/notifications/$id/read';
  static String notification(String id) => '/api/notifications/$id';

  // QR
  static const String qrGenerate = '/api/qr/generate';
  static const String qrVerify = '/api/qr/verify';
  static const String qrAction = '/api/qr/action';

  // Misc
  static const String feedback = '/api/feedback';
  static const String announcements = '/api/announcements';
  static const String contact = '/api/contact';
}
