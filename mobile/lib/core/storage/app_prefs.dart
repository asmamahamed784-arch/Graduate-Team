import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// One past Track Queue lookup, cached locally purely to save the citizen a
/// re-type — never a source of truth for status (that always comes fresh
/// from the backend when tapped).
class RecentQueueSearch {
  const RecentQueueSearch({
    required this.reference,
    required this.centerName,
    required this.serviceName,
    required this.searchedAt,
  });

  final String reference;
  final String centerName;
  final String serviceName;
  final DateTime searchedAt;

  Map<String, dynamic> toJson() => {
        'reference': reference,
        'centerName': centerName,
        'serviceName': serviceName,
        'searchedAt': searchedAt.toIso8601String(),
      };

  factory RecentQueueSearch.fromJson(Map<String, dynamic> json) =>
      RecentQueueSearch(
        reference: json['reference'] as String? ?? '',
        centerName: json['centerName'] as String? ?? '',
        serviceName: json['serviceName'] as String? ?? '',
        searchedAt:
            DateTime.tryParse(json['searchedAt'] as String? ?? '') ??
                DateTime.now(),
      );
}

/// Lightweight first-run preferences (onboarding, recent queue searches).
class AppPrefs {
  AppPrefs(this._prefs);

  final SharedPreferences _prefs;

  static const _onboardingKey = 'nqs_onboarding_seen';
  static const _recentQueueSearchesKey = 'nqs_recent_queue_searches';
  static const _maxRecentSearches = 5;

  bool get onboardingSeen => _prefs.getBool(_onboardingKey) ?? false;

  Future<void> setOnboardingSeen([bool value = true]) =>
      _prefs.setBool(_onboardingKey, value);

  List<RecentQueueSearch> get recentQueueSearches {
    final raw = _prefs.getStringList(_recentQueueSearchesKey) ?? const [];
    return raw
        .map((entry) {
          try {
            return RecentQueueSearch.fromJson(
              jsonDecode(entry) as Map<String, dynamic>,
            );
          } catch (_) {
            return null;
          }
        })
        .whereType<RecentQueueSearch>()
        .toList();
  }

  Future<void> addRecentQueueSearch(RecentQueueSearch search) async {
    final existing = recentQueueSearches
        .where((s) => s.reference != search.reference)
        .toList();
    final updated = [search, ...existing].take(_maxRecentSearches).toList();
    await _prefs.setStringList(
      _recentQueueSearchesKey,
      updated.map((s) => jsonEncode(s.toJson())).toList(),
    );
  }

  Future<void> clearRecentQueueSearches() =>
      _prefs.remove(_recentQueueSearchesKey);
}

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('Override sharedPreferencesProvider in main.dart');
});

final appPrefsProvider = Provider<AppPrefs>((ref) {
  return AppPrefs(ref.watch(sharedPreferencesProvider));
});
