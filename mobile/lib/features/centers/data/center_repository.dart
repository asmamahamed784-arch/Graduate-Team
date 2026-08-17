import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../shared/models/center.dart';

class CenterRepository {
  const CenterRepository(this._api);

  final ApiClient _api;

  Future<List<CenterModel>> list({String? district}) async {
    final rows = await _api.getList(
      ApiEndpoints.centers,
      query: {if (district != null && district.isNotEmpty) 'district': district},
    );
    return rows.map(CenterModel.fromJson).toList();
  }

  Future<CenterModel> byId(String id) async =>
      CenterModel.fromJson(await _api.getObject(ApiEndpoints.center(id)));
}

final centerRepositoryProvider = Provider<CenterRepository>(
  (ref) => CenterRepository(ref.watch(apiClientProvider)),
);

final centersProvider = FutureProvider<List<CenterModel>>(
  (ref) => ref.watch(centerRepositoryProvider).list(),
);

final activeCentersProvider = Provider<List<CenterModel>>((ref) {
  final centers = ref.watch(centersProvider).value ?? const [];
  return centers.where((center) => center.isActive).toList();
});

/// Distinct districts, used by the centers filter and booking forms.
/// Built from centers in the database (not a hardcoded Banadir list).
final centerDistrictsProvider = Provider<List<String>>((ref) {
  final centers = ref.watch(centersProvider).value ?? const [];
  final options = <String>{};

  for (final center in centers) {
    final district = center.district.trim();
    if (district.isNotEmpty) options.add(district);

    // Custom district centers (created in Admin) also appear as options,
    // matching the web New ID registration form.
    final name = center.name.trim();
    final isGenericNationalIdCenter =
        RegExp(r'national\s+id\s+center', caseSensitive: false).hasMatch(name);
    if (name.isNotEmpty && !isGenericNationalIdCenter) {
      options.add(name);
    }
  }

  final districts = options.toList()..sort();
  return districts;
});

final centerByIdProvider = FutureProvider.family<CenterModel, String>(
  isAutoDispose: true,
  (ref, id) async {
    final cached = ref.watch(centersProvider).value;
    if (cached != null) {
      for (final center in cached) {
        if (center.id == id) return center;
      }
    }
    return ref.watch(centerRepositoryProvider).byId(id);
  },
);
