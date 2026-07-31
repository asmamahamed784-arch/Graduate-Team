import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../shared/models/appointment.dart';
import '../models/operator_models.dart';

class OperatorRepository {
  const OperatorRepository(this._api);

  final ApiClient _api;

  Future<OperatorDashboardData> getDashboard() async {
    final data = await _api.getObject(ApiEndpoints.operatorDashboard);
    return OperatorDashboardData.fromJson(data);
  }

  Future<List<Appointment>> getQueue() async {
    try {
      final data = await _api.getObject(ApiEndpoints.operatorQueue);
      final parsed = OperatorQueueData.fromJson(data);
      if (parsed.waitingTickets.isNotEmpty) return parsed.waitingTickets;
      return parsed.allActiveTickets
          .where((ticket) => ticket.status == TicketStatus.waiting)
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<OperatorQueueData> getQueueData() async {
    try {
      final data = await _api.getObject(ApiEndpoints.operatorQueue);
      return OperatorQueueData.fromJson(data);
    } catch (_) {
      return const OperatorQueueData();
    }
  }

  Future<Appointment> callNext({String? centerId}) async {
    final body = {if (centerId != null && centerId.isNotEmpty) 'centerId': centerId};
    try {
      final data = await _api.post(ApiEndpoints.operatorCallNext, body: body);
      return Appointment.fromJson(data);
    } on ApiException {
      final data = await _api.post(ApiEndpoints.queueCallNext, body: body);
      return Appointment.fromJson(data);
    }
  }

  Future<Appointment> hold(String id) async {
    final data = await _api.put(ApiEndpoints.queueHold(id));
    return Appointment.fromJson(data);
  }

  Future<Appointment> complete(String id, {String? otpToken}) async {
    final body = {
      if (otpToken != null && otpToken.isNotEmpty) 'otpToken': otpToken,
    };
    try {
      final data = await _api.put(ApiEndpoints.queueComplete(id), body: body);
      return Appointment.fromJson(data);
    } on ApiException {
      final data = await _api.put(
        ApiEndpoints.adminBookingStatus(id),
        body: {
          'status': TicketStatus.completed,
          if (otpToken != null && otpToken.isNotEmpty) 'otpToken': otpToken,
        },
      );
      return Appointment.fromJson(data);
    }
  }

  Future<Appointment> cancel(String id, {String? reason}) async {
    final data = await _api.put(
      ApiEndpoints.cancelBooking(id),
      body: {
        if (reason != null && reason.trim().isNotEmpty)
          'cancellationReason': reason.trim(),
      },
    );
    return Appointment.fromJson(data);
  }

  Future<Appointment> sendCorrection(
    String id, {
    required List<String> reasons,
    required String notes,
  }) async {
    final data = await _api.put(
      ApiEndpoints.adminBookingCorrection(id),
      body: {
        'reasons': reasons,
        'correctionReasons': reasons,
        'additionalNote': notes.trim(),
        'additionalNotes': notes.trim(),
      },
    );
    return Appointment.fromJson(data);
  }

  Future<Map<String, dynamic>> verifyQr(String code) async {
    final trimmed = code.trim();
    return _api.post(
      ApiEndpoints.qrVerify,
      body: {'code': trimmed, 'text': trimmed, 'ticketRef': trimmed},
    );
  }

  Future<Map<String, dynamic>> qrAction({
    required String code,
    required String action,
    String? reason,
  }) async {
    final trimmed = code.trim();
    return _api.post(
      ApiEndpoints.qrAction,
      body: {
        'code': trimmed,
        'text': trimmed,
        'ticketRef': trimmed,
        'action': action,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
    );
  }

  Future<Appointment> lookupByReference(String reference) async {
    final data = await _api.getObject(ApiEndpoints.booking(reference.trim()));
    return Appointment.fromJson(data);
  }
}

final operatorRepositoryProvider = Provider<OperatorRepository>(
  (ref) => OperatorRepository(ref.watch(apiClientProvider)),
);
