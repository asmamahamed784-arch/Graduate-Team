import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Single readable type system for the citizen app.
/// Font: Plus Jakarta Sans — clear at small sizes, consistent weights.
class AppTypography {
  const AppTypography._();

  static String? get fontFamily =>
      GoogleFonts.plusJakartaSans().fontFamily;

  static TextStyle _base({
    required double size,
    required FontWeight weight,
    required Color color,
    double height = 1.4,
    double letterSpacing = 0,
  }) {
    return GoogleFonts.plusJakartaSans(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextTheme textTheme({required Color ink, Color? muted}) {
    final soft = muted ?? AppColors.muted;
    return TextTheme(
      displaySmall: _base(
        size: 28,
        weight: FontWeight.w700,
        color: ink,
        height: 1.2,
        letterSpacing: -0.3,
      ),
      headlineMedium: _base(
        size: 24,
        weight: FontWeight.w700,
        color: ink,
        height: 1.25,
        letterSpacing: -0.2,
      ),
      headlineSmall: _base(
        size: 22,
        weight: FontWeight.w700,
        color: ink,
        height: 1.25,
        letterSpacing: -0.2,
      ),
      titleLarge: _base(
        size: 18,
        weight: FontWeight.w700,
        color: ink,
        height: 1.3,
      ),
      titleMedium: _base(
        size: 16,
        weight: FontWeight.w600,
        color: ink,
        height: 1.35,
      ),
      titleSmall: _base(
        size: 14,
        weight: FontWeight.w600,
        color: ink,
        height: 1.35,
      ),
      bodyLarge: _base(
        size: 16,
        weight: FontWeight.w500,
        color: ink,
        height: 1.5,
      ),
      bodyMedium: _base(
        size: 14.5,
        weight: FontWeight.w500,
        color: ink,
        height: 1.5,
      ),
      bodySmall: _base(
        size: 12.5,
        weight: FontWeight.w500,
        color: soft,
        height: 1.45,
      ),
      labelLarge: _base(
        size: 14,
        weight: FontWeight.w600,
        color: ink,
        height: 1.3,
      ),
      labelMedium: _base(
        size: 12,
        weight: FontWeight.w600,
        color: soft,
        height: 1.3,
      ),
      labelSmall: _base(
        size: 11,
        weight: FontWeight.w600,
        color: soft,
        height: 1.25,
        letterSpacing: 0.1,
      ),
    );
  }

  /// Screen / card titles
  static TextStyle title(Color color) => _base(
        size: 18,
        weight: FontWeight.w700,
        color: color,
        height: 1.3,
      );

  /// Section headings
  static TextStyle section(Color color) => _base(
        size: 16,
        weight: FontWeight.w700,
        color: color,
        height: 1.3,
      );

  /// Body copy
  static TextStyle body(Color color) => _base(
        size: 14.5,
        weight: FontWeight.w500,
        color: color,
        height: 1.5,
      );

  /// Captions / meta (location, hours, hints)
  static TextStyle caption(Color color) => _base(
        size: 12.5,
        weight: FontWeight.w500,
        color: color,
        height: 1.4,
      );

  /// Buttons / chips
  static TextStyle button(Color color) => _base(
        size: 14,
        weight: FontWeight.w600,
        color: color,
        height: 1.2,
      );
}
