import '../constants/app_constants.dart';

/// Normalizes backend role strings so routing never depends on casing.
/// Supports: ADMIN, Admin, admin, OPERATOR, USER → citizen, etc.
String normalizeRole(String? raw) {
  final role = (raw ?? '').trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (role.isEmpty) return AppConstants.citizenRole;

  switch (role) {
    case 'user':
    case 'citizen':
    case 'citizens':
      return AppConstants.citizenRole;
    case 'admin':
    case 'administrator':
      return AppConstants.adminRole;
    case 'superadmin':
    case 'super_admin':
      return AppConstants.superAdminRole;
    case 'user_manager':
    case 'usermanager':
      return AppConstants.userManagerRole;
    case 'operator':
      return AppConstants.operatorRole;
    case 'super_operator':
    case 'superoperator':
      return AppConstants.superOperatorRole;
    case 'center_manager':
    case 'centermanager':
      return AppConstants.centerManagerRole;
    default:
      return role;
  }
}

bool roleIsAdmin(String? role) =>
    AppConstants.adminRoles.contains(normalizeRole(role));

bool roleIsOperator(String? role) =>
    AppConstants.operatorRoles.contains(normalizeRole(role));

bool roleIsCitizen(String? role) {
  final normalized = normalizeRole(role);
  if (roleIsAdmin(normalized) || roleIsOperator(normalized)) return false;
  return normalized == AppConstants.citizenRole || normalized == 'user';
}
