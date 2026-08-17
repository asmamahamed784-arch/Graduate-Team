import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/utils/json_utils.dart';

/// `GET /api/reports/public-home-stats` — no auth required, safe to call
/// from the guest-facing Home screen before the citizen signs in.
class PublicHomeStats {
  const PublicHomeStats({
    required this.appointmentsBooked,
    required this.registeredCitizens,
    required this.serviceCenters,
  });

  final int appointmentsBooked;
  final int registeredCitizens;
  final int serviceCenters;

  factory PublicHomeStats.fromJson(Map<String, dynamic> json) => PublicHomeStats(
        appointmentsBooked: Json.intOf(json['appointmentsBooked']),
        registeredCitizens: Json.intOf(json['happyCitizens']),
        serviceCenters: Json.intOf(json['serviceCenters']),
      );

  static const empty = PublicHomeStats(
    appointmentsBooked: 0,
    registeredCitizens: 0,
    serviceCenters: 0,
  );
}

class PublicStatsRepository {
  const PublicStatsRepository(this._api);

  final ApiClient _api;

  Future<PublicHomeStats> fetch() async {
    final json = await _api.getObject(
      ApiEndpoints.publicHomeStats,
      skipAuth: true,
    );
    return PublicHomeStats.fromJson(json);
  }
}

final publicStatsRepositoryProvider = Provider<PublicStatsRepository>(
  (ref) => PublicStatsRepository(ref.watch(apiClientProvider)),
);

final publicHomeStatsProvider = FutureProvider<PublicHomeStats>(
  (ref) => ref.watch(publicStatsRepositoryProvider).fetch(),
);
