import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/models/center.dart';
import '../../../shared/models/service.dart';
import '../models/admin_models.dart';

class AdminRepository {
  const AdminRepository(this._api);

  final ApiClient _api;

  Future<AdminDashboardStats> dashboardStats() async {
    final data = await _api.getObject(ApiEndpoints.reportStats);
    return AdminDashboardStats.fromJson(data);
  }

  Future<List<Appointment>> allBookings() async {
    final rows = await _api.getList(ApiEndpoints.adminBookings);
    return rows.map(Appointment.fromJson).toList();
  }

  Future<List<AdminUserRow>> users() async {
    final rows = await _api.getList(ApiEndpoints.users);
    return rows.map(AdminUserRow.fromJson).toList();
  }

  Future<void> setUserStatus(String id, String status) async {
    await _api.put(ApiEndpoints.userStatus(id), body: {'status': status});
  }

  Future<List<AdminOperatorRow>> operators() async {
    final rows = await _api.getList(ApiEndpoints.operators);
    return rows.map(AdminOperatorRow.fromJson).toList();
  }

  Future<void> approveOperator(String id) async {
    await _api.put(ApiEndpoints.operatorApprove(id));
  }

  Future<void> rejectOperator(String id) async {
    await _api.put(ApiEndpoints.operatorReject(id));
  }

  Future<void> activateOperator(String id) async {
    await _api.put(ApiEndpoints.operatorActivate(id));
  }

  Future<void> deactivateOperator(String id) async {
    await _api.put(ApiEndpoints.operatorDeactivate(id));
  }

  Future<List<ServiceModel>> services() async {
    final rows = await _api.getList(ApiEndpoints.services);
    return rows.map(ServiceModel.fromJson).toList();
  }

  Future<ServiceModel> createService(Map<String, dynamic> body) async =>
      ServiceModel.fromJson(await _api.post(ApiEndpoints.services, body: body));

  Future<ServiceModel> updateService(String id, Map<String, dynamic> body) async =>
      ServiceModel.fromJson(await _api.put(ApiEndpoints.service(id), body: body));

  Future<void> deleteService(String id) async {
    await _api.delete(ApiEndpoints.service(id));
  }

  Future<List<CenterModel>> centers() async {
    final rows = await _api.getList(ApiEndpoints.centers);
    return rows.map(CenterModel.fromJson).toList();
  }

  Future<CenterModel> createCenter(Map<String, dynamic> body) async =>
      CenterModel.fromJson(await _api.post(ApiEndpoints.centers, body: body));

  Future<CenterModel> updateCenter(String id, Map<String, dynamic> body) async =>
      CenterModel.fromJson(await _api.put(ApiEndpoints.center(id), body: body));

  Future<void> deleteCenter(String id) async {
    await _api.delete(ApiEndpoints.center(id));
  }

  Future<List<AdminSessionRow>> sessions() async {
    final rows = await _api.getList(ApiEndpoints.sessions);
    return rows.map(AdminSessionRow.fromJson).toList();
  }

  Future<void> invalidateSession(String id) async {
    await _api.put(ApiEndpoints.invalidateSession(id));
  }

  Future<List<AdminActivityRow>> activities() async {
    final rows = await _api.getList(ApiEndpoints.activities);
    return rows.map(AdminActivityRow.fromJson).toList();
  }

  Future<Map<String, dynamic>> analytics() async {
    return _api.getObject(ApiEndpoints.reportAnalytics);
  }

  Future<Appointment> bookingById(String id) async =>
      Appointment.fromJson(await _api.getObject(ApiEndpoints.booking(id)));

  Future<Appointment> updateBookingStatus(
    String id, {
    required String status,
    String? otpToken,
    String? reason,
    List<String>? cancellationReasons,
    String? additionalNotes,
  }) async {
    final data = await _api.put(
      ApiEndpoints.adminBookingStatus(id),
      body: {
        'status': status,
        if (otpToken != null) 'otpToken': otpToken,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
        if (reason != null && reason.isNotEmpty) 'cancellationReason': reason,
        if (cancellationReasons != null) 'cancellationReasons': cancellationReasons,
        if (additionalNotes != null) 'additionalNotes': additionalNotes,
      },
    );
    return Appointment.fromJson(data);
  }

  Future<Appointment> updateRequestStatus(String id, String requestStatus) async {
    final data = await _api.put(
      ApiEndpoints.adminBookingRequestStatus(id),
      body: {'requestStatus': requestStatus},
    );
    return Appointment.fromJson(data);
  }

  Future<Appointment> updateReplacementStatus(String id, String status) async {
    final data = await _api.put(
      ApiEndpoints.adminBookingReplacementStatus(id),
      body: {'status': status, 'requestStatus': status},
    );
    return Appointment.fromJson(data);
  }

  Future<Appointment> sendCorrection(
    String id, {
    required List<String> reasons,
    String notes = '',
  }) async {
    final data = await _api.put(
      ApiEndpoints.adminBookingCorrection(id),
      body: {
        'reasonIds': reasons,
        'reasons': reasons,
        'correctionReasonIds': reasons,
        'notes': notes,
        'additionalNotes': notes,
      },
    );
    return Appointment.fromJson(data);
  }

  Future<Map<String, dynamic>> verifyQr(String code) async {
    return _api.post(ApiEndpoints.qrVerify, body: {'code': code, 'text': code});
  }

  Future<Map<String, dynamic>> qrAction({
    required String code,
    required String action,
    String? reason,
  }) async {
    return _api.post(
      ApiEndpoints.qrAction,
      body: {
        'code': code,
        'text': code,
        'action': action,
        if (reason != null) 'reason': reason,
      },
    );
  }
}

final adminRepositoryProvider = Provider<AdminRepository>(
  (ref) => AdminRepository(ref.watch(apiClientProvider)),
);
