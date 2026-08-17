import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/appointments/presentation/appointment_detail_screen.dart';
import '../../features/appointments/presentation/appointment_history_screen.dart';
import '../../features/appointments/presentation/appointment_section_screen.dart';
import '../../features/appointments/presentation/booking_screen.dart';
import '../../features/appointments/presentation/booking_success_screen.dart';
import '../../features/appointments/presentation/correction_required_screen.dart';
import '../../features/appointments/presentation/my_appointments_overview_screen.dart';
import '../../features/appointments/presentation/reschedule_appointment_screen.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/otp_flow.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/onboarding_screen.dart';
import '../../features/auth/presentation/otp_verification_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/reset_password_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/profile/presentation/about_screen.dart';
import '../../features/profile/presentation/contact_screen.dart';
import '../../features/profile/presentation/help_support_screen.dart';
import '../../features/centers/presentation/center_detail_screen.dart';
import '../../features/centers/presentation/centers_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/profile/presentation/change_password_screen.dart';
import '../../features/profile/presentation/edit_profile_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/profile/presentation/settings_screen.dart';
import '../../features/queue/presentation/qr_ticket_screen.dart';
import '../../features/queue/presentation/track_queue_screen.dart';
import '../../features/services/presentation/services_screen.dart';

/// Citizen-only route table. Staff portals (admin, operator, center manager)
/// live in the web app, so the mobile app never exposes them.
class AppRoutes {
  const AppRoutes._();

  static const String splash = '/splash';
  static const String onboarding = '/onboarding';
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';
  static const String verifyOtp = '/verify-otp';
  static const String help = '/help';
  static const String about = '/about';
  static const String contact = '/contact';

  static const String home = '/home';
  static const String services = '/services';
  static const String appointments = '/appointments';
  static const String notifications = '/notifications';
  static const String profile = '/profile';

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
  static String appointmentSection(String id, String section) =>
      '/appointments/detail/$id/$section';
  static String appointmentField(String id, String fieldKey, {String? label}) {
    final q = label == null || label.isEmpty
        ? ''
        : '?label=${Uri.encodeComponent(label)}';
    return '/appointments/detail/$id/field/${Uri.encodeComponent(fieldKey)}$q';
  }

  static String ticket(String reference) => '/ticket/$reference';
  static String trackRef(String reference) => '/track?ref=$reference';
  static String correction(String id) => '/appointments/correction/$id';
  static String reschedule(String id) => '/appointments/reschedule/$id';
}

/// Only makes sense signed out; visiting one while authenticated bounces
/// to Home instead.
const _signedOutRoutes = {
  AppRoutes.onboarding,
  AppRoutes.login,
  AppRoutes.register,
  AppRoutes.forgotPassword,
  AppRoutes.resetPassword,
};

/// Help routes stay available when a citizen cannot sign in.
const _supportRoutes = {AppRoutes.help, AppRoutes.contact};

/// The mobile app is login-first: Home and citizen data routes require an
/// authenticated citizen session.
final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _citizenShellKey = GlobalKey<NavigatorState>(debugLabel: 'citizenShell');

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

      if (location == AppRoutes.verifyOtp) return null;
      if (_supportRoutes.contains(location)) return null;
      if (location == AppRoutes.splash) {
        // Home is only shown after a successful login.
        if (auth.isResolving) return null;
        return auth.isAuthenticated ? AppRoutes.home : AppRoutes.login;
      }
      if (auth.isResolving) return AppRoutes.splash;

      final isSignedOutRoute = _signedOutRoutes.contains(location);

      if (!auth.isAuthenticated) {
        if (isSignedOutRoute) return null;
        // A personal screen reached without going through ensureSignedIn
        // (deep link, restored URL, …) — remember it and bounce to Login.
        return Uri(
          path: AppRoutes.login,
          queryParameters: {'redirectTo': location},
        ).toString();
      }

      if (isSignedOutRoute) return AppRoutes.home;

      return null;
    },
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (_, __) => const OnboardingScreen(),
      ),
      GoRoute(path: AppRoutes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: AppRoutes.register,
        builder: (_, __) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        builder: (_, state) =>
            ResetPasswordScreen(args: state.extra as ResetPasswordArgs?),
      ),
      GoRoute(
        path: AppRoutes.verifyOtp,
        builder: (_, state) =>
            OtpVerificationScreen(args: state.extra as OtpArgs),
      ),

      // Citizen shell
      StatefulShellRoute.indexedStack(
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __, navigationShell) =>
            HomeShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: _citizenShellKey,
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (_, __) => const HomeScreen(),
              ),
              // Stays inside the shell so drawer + bottom nav remain visible.
              GoRoute(
                path: AppRoutes.centers,
                builder: (_, __) => const CentersScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.services,
                builder: (_, __) => const ServicesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.appointments,
                builder: (_, __) => const MyAppointmentsOverviewScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.notifications,
                builder: (_, __) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (_, __) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // Full-screen routes opened on top of the shell
      GoRoute(
        path: '/services/:serviceId/book',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) =>
            BookingScreen(serviceId: state.pathParameters['serviceId']!),
      ),
      // Old "Service details" page removed — jump straight to booking.
      GoRoute(
        path: '/services/:serviceId',
        parentNavigatorKey: _rootNavigatorKey,
        redirect: (_, state) =>
            AppRoutes.book(state.pathParameters['serviceId']!),
      ),
      GoRoute(
        path: '/centers/:centerId',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) =>
            CenterDetailScreen(centerId: state.pathParameters['centerId']!),
      ),
      GoRoute(
        path: AppRoutes.history,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AppointmentHistoryScreen(),
      ),
      GoRoute(
        path: '/appointments/detail/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) =>
            AppointmentDetailScreen(appointmentId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/appointments/detail/:id/field/:fieldKey',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => AppointmentFieldDetailScreen(
          appointmentId: state.pathParameters['id']!,
          fieldKey: Uri.decodeComponent(state.pathParameters['fieldKey']!),
          fieldLabel: state.uri.queryParameters['label'],
        ),
      ),
      GoRoute(
        path: '/appointments/detail/:id/:section',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) {
          final section = appointmentSectionFromPath(
            state.pathParameters['section'] ?? '',
          );
          if (section == null) {
            return AppointmentDetailScreen(
              appointmentId: state.pathParameters['id']!,
            );
          }
          return AppointmentSectionScreen(
            appointmentId: state.pathParameters['id']!,
            section: section,
          );
        },
      ),
      GoRoute(
        path: '/appointments/correction/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => CorrectionRequiredScreen(
          appointmentId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/appointments/reschedule/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) => RescheduleAppointmentScreen(
          appointmentId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.bookingSuccess,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, state) =>
            BookingSuccessScreen(args: state.extra as BookingSuccessArgs),
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
        builder: (_, state) =>
            QrTicketScreen(reference: state.pathParameters['reference']!),
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
      GoRoute(
        path: AppRoutes.help,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const HelpSupportScreen(),
      ),
      GoRoute(
        path: AppRoutes.about,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const AboutScreen(),
      ),
      GoRoute(
        path: AppRoutes.contact,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const ContactScreen(),
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      appBar: AppBar(title: const Text('Page not found')),
      body: Center(child: Text('No screen for ${state.uri}')),
    ),
  );
});
