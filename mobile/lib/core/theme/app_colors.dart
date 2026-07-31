import 'package:flutter/material.dart';

/// Government-blue light theme for the NQS mobile app.
class AppColors {
  const AppColors._();

  static const Color primary = Color(0xFF0B3A75);
  static const Color primaryDark = Color(0xFF082A55);
  static const Color primarySoft = Color(0xFFE8F0FA);

  static const Color navy = Color(0xFF0B3A75);
  static const Color navyDark = Color(0xFF082A55);
  static const Color navyDeepest = Color(0xFF06194A);
  static const Color accent = Color(0xFF1D5BBF);
  static const Color accentSoft = Color(0xFF8BB0FF);

  static const Color lightBackground = Color(0xFFF4F6FB);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE8EEF7);

  static const Color darkBackground = Color(0xFF0B1220);
  static const Color darkSurface = Color(0xFF151E2E);
  static const Color darkElevated = Color(0xFF1C273A);
  static const Color darkBorder = Color(0xFF2A364A);

  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF1D5BBF);
  static const Color muted = Color(0xFF6B7280);
  static const Color ink = Color(0xFF111827);

  static Color forStatus(String? status) {
    switch (status?.toLowerCase().trim()) {
      case 'completed':
      case 'approved':
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
        return const Color(0xFFB45309);
      case 'cancelled':
      case 'rejected':
        return danger;
      default:
        return muted;
    }
  }
}
