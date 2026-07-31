import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Light / dark / system preference, persisted like the web app's `nqs-theme`.
class ThemeController extends Notifier<ThemeMode> {
  static const String _key = 'nqs-theme';

  @override
  ThemeMode build() {
    _restore();
    return ThemeMode.system;
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_key);
    if (stored == null) return;
    state = ThemeMode.values.firstWhere(
      (mode) => mode.name == stored,
      orElse: () => ThemeMode.system,
    );
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, mode.name);
  }

  Future<void> toggle(BuildContext context) {
    final isDark = state == ThemeMode.dark ||
        (state == ThemeMode.system &&
            MediaQuery.platformBrightnessOf(context) == Brightness.dark);
    return set(isDark ? ThemeMode.light : ThemeMode.dark);
  }
}

final themeControllerProvider =
    NotifierProvider<ThemeController, ThemeMode>(ThemeController.new);
