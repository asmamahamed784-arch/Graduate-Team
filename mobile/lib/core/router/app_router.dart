import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/presentation/admin_activity_screen.dart';
import '../../features/admin/presentation/admin_appointments_screen.dart';
import '../../features/admin/presentation/admin_booking_detail_screen.dart';
import '../../features/admin/presentation/admin_centers_screen.dart';
import '../../features/admin/presentation/admin_home_screen.dart';
import '../../features/admin/presentation/admin_notifications_screen.dart';
import '../../features/admin/presentation/admin_operators_screen.dart';
import '../../features/admin/presentation/admin_profile_screen.dart';
import '../../features/admin/presentation/admin_qr_scan_screen.dart';
import '../../features/admin/presentation/admin_queue_screen.dart';
import '../../features/admin/presentation/admin_reports_screen.dart';
import '../../features/admin/presentation/admin_requests_screen.dart';
import '../../features/admin/presentation/admin_services_screen.dart';
import '../../features/admin/presentation/admin_sessions_screen.dart';
import '../../features/admin/presentation/admin_shell.dart';
import '../../features/admin/presentation/admin_users_screen.dart';
import '../../features/appointments/presentation/appointment_detail_screen.dart';
import '../../features/appointments/presentation/appointment_history_screen.dart';
import '../../features/appointments/presentation/booking_screen.dart';
import '../../features/appointments/presentation/booking_success_screen.dart';
import '../../features/appointments/presentation/my_appointments_screen.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/otp_flow.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/otp_verification_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/reset_password_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/centers/presentation/center_detail_screen.dart';
import '../../features/centers/presentation/centers_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/operator/presentation/operator_call_next_screen.dart';
import '../../features/operator/presentation/operator_citizen_detail_screen.dart';
import '../../features/operator/presentation/operator_completed_screen.dart';
import '../../features/operator/presentation/operator_corrections_screen.dart';
import '../../features/operator/presentation/operator_home_screen.dart';
import '../../features/operator/presentation/operator_notifications_screen.dart';
import '../../features/operator/presentation/operator_profile_screen.dart';
import '../../features/operator/presentation/operator_qr_scan_screen.dart';
import '../../features/operator/presentation/operator_queue_screen.dart';
import '../../features/operator/presentation/operator_shell.dart';
import '../../features/profile/presentation/change_password_screen.dart';
import '../../features/profile/presentation/edit_profile_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/profile/presentation/settings_screen.dart';
import '../../features/queue/presentation/qr_ticket_screen.dart';
import '../../features/queue/presentation/track_queue_screen.dart';
import '../../features/services/presentation/service_detail_screen.dart';
import '../../features/services/presentation/services_screen.dart';
import 'role_home.dart';

class AppRoutes {
  const AppRoutes._();

  static const String splash = '/splash';
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';
  static const String verifyOtp = '/verify-otp';

  static const String home = '/home';
  static const String services = '/services';
  static const String appointments = '/appointments';
  static const String notifications = '/notifications';
  static const String profile = '/profile';

  static const String adminHome = '/admin/home';
  static const String adminRequests = '/admin/requests';
  static const String adminQueue = '/admin/queue';
  static const String adminNotifications = '/admin/notifications';
  static const String adminProfile = '/admin/profile';
  static const String adminAppointments = '/admin/appointments';
  static const String adminOperators = '/admin/operators';
  static const String adminUsers = '/admin/users';
  static const String adminSessions = '/admin/sessions';
  static const String adminReports = '/admin/reports';
  static const String adminServices = '/admin/services';
  static const String adminCenters = '/admin/centers';
  static const String adminQrScan = '/admin/qr-scan';
  static const String adminActivity = '/admin/activity';
  static String adminBookingDetail(String id) => '/admin/bookings/$id';

  static const String operatorHome = '/operator/home';
  static const String operatorQueue = '/operator/queue';
  static const String operatorCallNext = '/operator/call-next';
  static const String operatorNotifications = '/operator/notifications';
  static const String operatorProfile = '/operator/profile';
  static const String operatorQrScan = '/operator/qr-scan';
  static const String operatorCitizenDetail = '/operator/citizen';
  static const String operatorCorrections = '/operator/corrections';
  static const String operatorCompleted = '/operator/completed';

  static const String centers = '/centers';
  static const String history = '/appointments/history';
  static const String track = '/track';
  static const String settings = '/settings';
  static const String editProfile = '/profile/edit';
  static const String changePassword = '/profile/password';
  static const String bookingSuccess = '/booking-success';

  static String serviceDetail(String id) => '/services/$id';
  static String book(String serviceId) => '/services/$serviceId/book';
  static String centerDetail(String id) => '/centers/$id';
  static String appointmentDetail(String id) => '/appointments/detail/$id';
  static String ticket(String reference) => '/ticket/$reference';
  static String trackRef(String reference) => '/track?ref=$reference';
}

const _guestRoutes = {
  AppRoutes.login,
  AppRoutes.register,
  AppRoutes.forgotPassword,
  AppRoutes.resetPassword,
};

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _citizenShellKey = GlobalKey<NavigatorState>(debugLabel: 'citizenShell');
final _adminShellKey = GlobalKey<NavigatorState>(debugLabel: 'adminShell');
final _operatorShellKey = GlobalKey<NavigatorState>(debugLabel: 'operatorShell');

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.onDispose(refresh.dispose);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;
      final user = auth.user;

      if (location == AppRoutes.verifyOtp) return null;

      if (auth.isResolving) {
        return location == AppRoutes.splash ? null : AppRoutes.splash;
      }

      final isGuestRoute = _guestRoutes.contains(location);

      if (!auth.isAuthenticated) {
        return isGuestRoute ? null : AppRoutes.login;
      }

      final home = homeRouteForUser(user);

      // Never show citizen shell while auth is ready but role home differs.
      if (isGuestRoute || location == AppRoutes.splash) return home;

      return roleGuardRedirect(user, location);
    },
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: AppRoutes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(path: AppRoutes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        builder: (_, state) => ResetPasswordScreen(
          args: state.extra as ResetPasswordArgs?,
        ),
      ),
      GoRoute(
        path: AppRoutes.verifyOtp,
        builder: (_, state) => OtpVerificationScreen(args: state.extra as OtpArgs),
      ),

      // Citizen shell
      StatefulShellRoute.indexedStack(
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __, navigationShell) => HomeShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _citizenShellKey,
            routes: [
              GoRoute(path: AppRoutes.home, builder: (_, __) => const HomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: AppRoutes.services, builder: (_, __) => const ServicesScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: AppRoutes.appointments, builder: (_, __) => const MyAppointmentsScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: AppRoutes.notifications, builder: (_, __) => const NotificationsScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: AppRoutes.profile, builder: (_, __) => const ProfileScreen()),
            ],
          ),
        ],
      ),

      // Admin shell
      StatefulShellRoute.indexedStack(
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __, navigationShell) => AdminShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _adminShellKey,
            routes: [
              GoRoute(path: AppRoutes.adminHome, builder: (_, __) => const AdminHomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.adminRequests,
                builder: (_, state) => AdminRequestsScreen(
                  initialFilter: state.uri.queryParameters['filter'],
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: AppRoutes.adminQueue, builder: (_, __) => const AdminQueueScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.adminNotifications,
                builder: (_, __) => const AdminNotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: AppRoutes.adminProfile, builder: (_, __) => const AdminProfileScreen()),
            ],
          ),
        ],
      ),

      // Operator shell
      StatefulShellRoute.indexedStack(
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __, navigationShell) => OperatorShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _operatorShellKey,
            routes: [
              GoRoute(path: AppRoutes.operatorHome, builder: (_, __) => const OperatorHomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: AppRoutes.operatorQueue, builder: (_, __) => const OperatorQueueScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.operatorCallNext,
                builder: (_, __) => const OperatorCallNextScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.operatorNotifications,
                builder: (_, __) => const OperatorNotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.operatorProfile,
                builder: (_, __) => const OperatorProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // Admin full-screen routes
      GoRoute(
        path: AppRoutes.adminAppointments,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => AdminAppointmentsScreen(
          initialFilter: state.uri.queryParameters['filter'],
        ),
      ),
      GoRoute(
        path: AppRoutes.adminOperators,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminOperatorsScreen(),
      ),
      GoRoute(
        path: AppRoutes.adminUsers,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminUsersScreen(),
      ),
      GoRoute(
        path: AppRoutes.adminSessions,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminSessionsScreen(),
      ),
      GoRoute(
        path: AppRoutes.adminReports,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminReportsScreen(),
      ),
      GoRoute(
        path: AppRoutes.adminServices,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminServicesScreen(),
      ),
      GoRoute(
        path: AppRoutes.adminCenters,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminCentersScreen(),
      ),
      GoRoute(
        path: AppRoutes.adminQrScan,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminQrScanScreen(),
      ),
      GoRoute(
        path: AppRoutes.adminActivity,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AdminActivityScreen(),
      ),
      GoRoute(
        path: '/admin/bookings/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => AdminBookingDetailScreen(
          bookingId: state.pathParameters['id']!,
        ),
      ),

      // Operator full-screen routes
      GoRoute(
        path: AppRoutes.operatorQrScan,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const OperatorQrScanScreen(),
      ),
      GoRoute(
        path: AppRoutes.operatorCitizenDetail,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const OperatorCitizenDetailScreen(),
      ),
      GoRoute(
        path: AppRoutes.operatorCorrections,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const OperatorCorrectionsScreen(),
      ),
      GoRoute(
        path: AppRoutes.operatorCompleted,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const OperatorCompletedScreen(),
      ),

      // Shared full-screen routes
      GoRoute(
        path: '/services/:serviceId/book',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => BookingScreen(
          serviceId: state.pathParameters['serviceId']!,
        ),
      ),
      GoRoute(
        path: '/services/:serviceId',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => ServiceDetailScreen(
          serviceId: state.pathParameters['serviceId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.centers,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const CentersScreen(),
      ),
      GoRoute(
        path: '/centers/:centerId',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => CenterDetailScreen(
          centerId: state.pathParameters['centerId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.history,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AppointmentHistoryScreen(),
      ),
      GoRoute(
        path: '/appointments/detail/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => AppointmentDetailScreen(
          appointmentId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.bookingSuccess,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => BookingSuccessScreen(
          args: state.extra as BookingSuccessArgs,
        ),
      ),
      GoRoute(
        path: AppRoutes.track,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => TrackQueueScreen(
          initialReference: state.uri.queryParameters['ref'],
        ),
      ),
      GoRoute(
        path: '/ticket/:reference',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => QrTicketScreen(
          reference: state.pathParameters['reference']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.editProfile,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const EditProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.changePassword,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const SettingsScreen(),
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      appBar: AppBar(title: const Text('Page not found')),
      body: Center(child: Text('No screen for ${state.uri}')),
    ),
  );
});
