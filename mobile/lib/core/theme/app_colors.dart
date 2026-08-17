import 'package:flutter/material.dart';

/// Citizen Service App palette — navy / blue only (no brown).
class AppColors {
  const AppColors._();

  /// Dark Navy Blue
  static const Color navyDeep = Color(0xFF0B3B78);

  /// Primary Blue
  static const Color primary = Color(0xFF0B55C4);
  static const Color primaryDark = Color(0xFF0B3B78);
  static const Color primarySoft = Color(0xFFEAF2FF);

  static const Color navy = Color(0xFF0B3B78);
  static const Color navyDark = Color(0xFF082A56);
  static const Color navyDeepest = Color(0xFF061F40);

  static const Color bookingAccent = Color(0xFF0B55C4);
  static const Color accent = Color(0xFF0B55C4);
  static const Color accentSoft = Color(0xFF6B9FE0);

  /// Off-white background
  static const Color lightBackground = Color(0xFFF7F9FC);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE4EAF3);

  static const Color darkBackground = Color(0xFF0B1220);
  static const Color darkSurface = Color(0xFF151E2E);
  static const Color darkElevated = Color(0xFF1C273A);
  static const Color darkBorder = Color(0xFF2A364A);

  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF0B55C4);
  static const Color muted = Color(0xFF667085);
  static const Color ink = Color(0xFF111827);

  static Color forStatus(String? status) {
    switch (status?.toLowerCase().trim()) {
      case 'completed':
      case 'approved':
      case 'active':
        return success;
      case 'being served':
      case 'in progress':
        return info;
      case 'waiting':
      case 'pending':
      case 'under review':
        return warning;
      case 'on hold':
      case 'resubmission required':
      case 'needs_correction':
      case 'correction required':
        return const Color(0xFFB45309);
      case 'cancelled':
      case 'rejected':
        return danger;
      default:
        return muted;
    }
  }
}
