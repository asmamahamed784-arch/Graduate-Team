import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../shared/models/service.dart';

class ServiceRepository {
  const ServiceRepository(this._api);

  final ApiClient _api;

  Future<List<ServiceModel>> list() async {
    final rows = await _api.getList(ApiEndpoints.services);
    return rows.map(ServiceModel.fromJson).toList();
  }

  Future<ServiceModel> byId(String id) async =>
      ServiceModel.fromJson(await _api.getObject(ApiEndpoints.service(id)));
}

final serviceRepositoryProvider = Provider<ServiceRepository>(
  (ref) => ServiceRepository(ref.watch(apiClientProvider)),
);

final servicesProvider = FutureProvider<List<ServiceModel>>(
  (ref) => ref.watch(serviceRepositoryProvider).list(),
);

/// Only the services a citizen can actually book.
final activeServicesProvider = Provider<List<ServiceModel>>((ref) {
  final services = ref.watch(servicesProvider).value ?? const [];
  return services.where((service) => service.isActive).toList();
});

final serviceByIdProvider = FutureProvider.family<ServiceModel, String>(
  isAutoDispose: true,
  (ref, id) async {
    final cached = ref.watch(servicesProvider).value;
    if (cached != null) {
      for (final service in cached) {
        if (service.id == id) return service;
      }
    }
    return ref.watch(serviceRepositoryProvider).byId(id);
  },
);
