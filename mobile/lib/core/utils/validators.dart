/// Client-side mirrors of the backend validation rules
/// (`backend/controllers/authController.js`) so users get instant feedback
/// instead of a round trip. The backend remains the source of truth.
class Validators {
  const Validators._();

  static final RegExp _username = RegExp(r'^[A-Za-z0-9._-]+$');
  static final RegExp _strongPassword =
      RegExp(r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$');
  static final RegExp _somaliPhone = RegExp(r'^61\d{7}$');

  static const String passwordRule =
      'Password must be at least 8 characters and include letters, numbers, and a special character.';
  static const String usernameRule =
      'Username may contain letters, numbers, dots, underscores, and hyphens.';
  static const String phoneRule = 'Enter a valid Somali phone number, e.g. 61 234 5678.';

  /// Strips `+252`, `252` and a leading `0` to the `61xxxxxxx` local form the
  /// backend stores.
  static String normalizePhone(String? value) {
    final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return '';
    var local = digits;
    if (local.startsWith('252')) local = local.substring(3);
    if (local.startsWith('0')) local = local.substring(1);
    return local;
  }

  static bool isValidPhone(String? value) => _somaliPhone.hasMatch(normalizePhone(value));

  static String? username(String? value) {
    final raw = value ?? '';
    if (raw.trim().isEmpty) return 'Username is required.';
    if (raw != raw.trim() || !_username.hasMatch(raw)) return usernameRule;
    if (raw.trim().length < 3) return 'Username must be at least 3 characters.';
    return null;
  }

  static String? password(String? value) {
    if ((value ?? '').isEmpty) return 'Password is required.';
    if (!_strongPassword.hasMatch(value!)) return passwordRule;
    return null;
  }

  static String? requiredPassword(String? value) {
    if ((value ?? '').isEmpty) return 'Password is required.';
    return null;
  }

  static String? confirmPassword(String? value, String original) {
    if ((value ?? '').isEmpty) return 'Confirm your password.';
    if (value != original) return 'Passwords do not match.';
    return null;
  }

  static String? phone(String? value, {bool required = true}) {
    final normalized = normalizePhone(value);
    if (normalized.isEmpty) return required ? 'Phone number is required.' : null;
    if (!_somaliPhone.hasMatch(normalized)) return phoneRule;
    return null;
  }

  static String? notEmpty(String? value, String label) {
    if ((value ?? '').trim().isEmpty) return '$label is required.';
    return null;
  }

  static String? minLength(String? value, int length, String label) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return '$label is required.';
    if (trimmed.length < length) return '$label must be at least $length characters.';
    return null;
  }

  static String? otpCode(String? value) {
    final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return 'Enter the code we sent you.';
    if (digits.length < 4) return 'The code is not complete.';
    return null;
  }

  static String? nationalId(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return 'National ID number is required.';
    if (trimmed.length < 4) return 'Enter a valid National ID number.';
    return null;
  }
}
