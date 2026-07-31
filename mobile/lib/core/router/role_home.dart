import '../../shared/models/app_user.dart';
import '../utils/role_utils.dart';
import 'app_router.dart';

/// Picks the correct mobile home route from the authenticated user's role only.
String homeRouteForUser(AppUser? user) {
  if (user == null) return AppRoutes.login;
  final role = normalizeRole(user.role);
  if (roleIsAdmin(role)) return AppRoutes.adminHome;
  if (roleIsOperator(role)) return AppRoutes.operatorHome;
  return AppRoutes.home;
}

bool isAdminPath(String location) =>
    location == AppRoutes.adminHome || location.startsWith('/admin');

bool isOperatorPath(String location) =>
    location == AppRoutes.operatorHome || location.startsWith('/operator');

/// Shared detail routes any authenticated role may open.
bool isSharedPath(String location) {
  const exact = {
    AppRoutes.centers,
    AppRoutes.history,
    AppRoutes.track,
    AppRoutes.settings,
    AppRoutes.editProfile,
    AppRoutes.changePassword,
    AppRoutes.bookingSuccess,
    AppRoutes.verifyOtp,
  };
  return exact.contains(location) ||
      location.startsWith('/centers/') ||
      location.startsWith('/appointments/detail') ||
      location.startsWith('/admin/bookings/') ||
      location.startsWith('/ticket/') ||
      location.startsWith('/track');
}

bool isCitizenPath(String location) {
  const roots = {
    AppRoutes.home,
    AppRoutes.services,
    AppRoutes.appointments,
    AppRoutes.notifications,
    AppRoutes.profile,
  };
  return roots.contains(location) ||
      location.startsWith('/services') ||
      location.startsWith('/appointments');
}

/// Redirect staff away from the wrong role shell.
String? roleGuardRedirect(AppUser? user, String location) {
  if (user == null) return null;
  if (isSharedPath(location)) return null;

  if (user.isAdmin) {
    if (!isAdminPath(location)) return AppRoutes.adminHome;
    return null;
  }
  if (user.isOperator) {
    if (!isOperatorPath(location)) return AppRoutes.operatorHome;
    return null;
  }
  // Citizen / user
  if (isAdminPath(location) || isOperatorPath(location)) return AppRoutes.home;
  return null;
}
