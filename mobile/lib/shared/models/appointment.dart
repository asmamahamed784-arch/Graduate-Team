import 'dart:convert';

import '../../core/constants/app_constants.dart';
import '../../core/utils/json_utils.dart';

/// A `Ticket` row as returned by `/api/bookings/*`.
///
/// `service`, `center` and `citizen` arrive either hydrated (nested object) or
/// as a bare id, so both the id and the display name are kept.
class Appointment {
  const Appointment({
    required this.id,
    required this.reference,
    required this.status,
    required this.requestType,
    required this.requestStatus,
    this.serviceId = '',
    this.serviceName = '',
    this.serviceDuration = 15,
    this.centerId = '',
    this.centerName = '',
    this.centerAddress = '',
    this.citizenName = '',
    this.counter = '--',
    this.queueNumber = '',
    this.ticketNumber = '',
    this.waitTime = '',
    this.district = '',
    this.date = '',
    this.timeSlot,
    this.nationalIdNumber = '',
    this.cardSerialNumber = '',
    this.cardStatus = '',
    this.registrationDetails,
    this.replacementDetails,
    this.updateDetails,
    this.cancellationReason = '',
    this.cancellationReasons = const [],
    this.cancellationNotes = '',
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String reference;
  final String status;
  final String requestType;
  final String requestStatus;
  final String serviceId;
  final String serviceName;
  final int serviceDuration;
  final String centerId;
  final String centerName;
  final String centerAddress;
  final String citizenName;
  final String counter;
  final String queueNumber;
  final String ticketNumber;
  final String waitTime;
  final String district;
  final String date;
  final String? timeSlot;
  final String nationalIdNumber;
  final String cardSerialNumber;
  final String cardStatus;
  final Map<String, dynamic>? registrationDetails;
  final Map<String, dynamic>? replacementDetails;
  final Map<String, dynamic>? updateDetails;
  final String cancellationReason;
  final List<String> cancellationReasons;
  final String cancellationNotes;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// An update-information request has no center, date or slot.
  bool get hasAppointmentSlot =>
      date.trim().isNotEmpty && requestType != RequestTypes.updateInformation;

  bool get isActive =>
      !TicketStatus.closedStatuses.contains(status) &&
      requestStatus != RequestStatus.cancelled &&
      requestStatus != RequestStatus.rejected;

  bool get isCancelled =>
      status == TicketStatus.cancelled ||
      requestStatus == RequestStatus.cancelled;

  bool get needsResubmission =>
      requestStatus == RequestStatus.resubmissionRequired ||
      requestStatus == RequestStatus.needsCorrection;

  bool get hasStaffCancellationFeedback =>
      cancellationReasons.isNotEmpty ||
      cancellationNotes.trim().isNotEmpty ||
      cancellationReason.trim().isNotEmpty;

  bool get isTrackable => hasAppointmentSlot && isActive;

  /// The backend lets a citizen cancel only within one hour of creation
  /// (`bookingController.cancelBooking`), so the button is hidden after that.
  bool get canCancel {
    if (!isActive) return false;
    const cancellable = {
      TicketStatus.pending,
      TicketStatus.waiting,
      'Scheduled',
    };
    if (!cancellable.contains(status)) return false;
    final created = createdAt;
    if (created == null) return false;
    return DateTime.now().difference(created) < const Duration(hours: 1);
  }

  /// Details block for the request type, used by detail screens.
  /// Strips staff cancellation metadata so citizens never see raw JSON dumps.
  Map<String, dynamic> get details {
    final raw =
        registrationDetails ?? replacementDetails ?? updateDetails ?? const {};
    if (raw.isEmpty) return const {};
    const hidden = {
      'cancellationDetails',
      'cancellationReason',
      'cancellationReasons',
      'cancellationNotes',
      'cancelledAt',
      'cancelledBy',
      'previousStatusBeforeCancellation',
      'additionalCancellationReason',
    };
    return {
      for (final entry in raw.entries)
        if (!hidden.contains(entry.key) && entry.value is! Map)
          entry.key: entry.value,
    };
  }

  String get requestTypeLabel => RequestTypes.label(requestType);

  factory Appointment.fromJson(Map<String, dynamic> json) {
    final service = json['service'];
    final center = json['center'];
    final registrationDetails = Json.mapOrNull(json['registrationDetails']);
    final replacementDetails = Json.mapOrNull(json['replacementDetails']);
    final updateDetails = Json.mapOrNull(json['updateDetails']);
    final embedded = _embeddedCancellation(
      json,
      registrationDetails,
      replacementDetails,
      updateDetails,
    );
    final additionalReason = Json.str(
      json['additionalCancellationReason'] ??
          json['additionalReason'] ??
          embedded['additionalCancellationReason'] ??
          embedded['additionalReason'],
    );
    final rawReasons = _stringList(
      json['cancellationReasons'] ??
          embedded['cancellationReasons'] ??
          embedded['reasons'],
    );
    final notes = Json.str(
      json['cancellationNotes'] ??
          json['additionalNotes'] ??
          embedded['cancellationNotes'] ??
          embedded['additionalNotes'],
    );
    final reasonSummary = Json.str(
      json['cancellationReason'] ??
          json['rejectionReason'] ??
          embedded['cancellationReason'] ??
          embedded['summary'],
    );
    final reasons = _displayCancellationReasons(
      rawReasons,
      additionalReason,
      reasonSummary,
    );
    return Appointment(
      id: Json.idOf(json),
      reference: Json.str(json['ref']),
      status: Json.str(json['status'], TicketStatus.waiting),
      requestType: Json.str(json['requestType'], RequestTypes.newNationalId),
      requestStatus: Json.str(json['requestStatus'], RequestStatus.pending),
      serviceId: Json.refId(service),
      serviceName: Json.refName(service),
      serviceDuration: service is Map
          ? Json.intOf(service['duration'], 15)
          : 15,
      centerId: Json.refId(center),
      centerName: Json.refName(center),
      centerAddress: center is Map ? Json.str(center['address']) : '',
      citizenName: Json.str(json['citizenName']),
      counter: Json.str(json['counter'], '--'),
      queueNumber: Json.str(
        json['queueNumber'],
        Json.str(json['counter'], Json.str(json['ref'])),
      ),
      ticketNumber: Json.str(json['ticketNumber'], Json.str(json['ref'])),
      waitTime: Json.str(json['waitTime']),
      district: Json.str(json['district']),
      date: Json.str(json['date']),
      timeSlot: Json.strOrNull(json['timeSlot']),
      nationalIdNumber: Json.str(json['nationalIdNumber']),
      cardSerialNumber: Json.str(json['cardSerialNumber']),
      cardStatus: Json.str(json['cardStatus']),
      registrationDetails: registrationDetails,
      replacementDetails: replacementDetails,
      updateDetails: updateDetails,
      cancellationReason: reasonSummary,
      cancellationReasons: reasons,
      cancellationNotes: notes,
      createdAt: Json.date(json['createdAt']),
      updatedAt: Json.date(json['updatedAt']),
    );
  }

  static List<String> _displayCancellationReasons(
    List<String> reasons,
    String additionalReason,
    String reasonSummary,
  ) {
    final visible = reasons
        .where((reason) => reason.trim().toLowerCase() != 'other')
        .expand(_splitReasonText)
        .toList();
    final hasOther = reasons.any(
      (reason) => reason.trim().toLowerCase() == 'other',
    );
    if (additionalReason.trim().isNotEmpty && (hasOther || visible.isEmpty)) {
      visible.addAll(_splitReasonText(additionalReason));
    }
    final unique = <String>{};
    final clean = [
      for (final reason in visible)
        if (unique.add(reason)) reason,
    ];
    if (clean.isNotEmpty) return clean;
    return _splitReasonText(reasonSummary);
  }

  static List<String> _stringList(dynamic value) {
    if (value is List) {
      return value.map(_reasonText).where((text) => text.isNotEmpty).toList();
    }
    if (value is Map) {
      return _stringList(
        value['cancellationReasons'] ??
            value['reasons'] ??
            value['reason'] ??
            value['summary'],
      );
    }
    if (value is String && value.trim().isNotEmpty) {
      try {
        final parsed = jsonDecode(value);
        return _stringList(parsed);
      } catch (_) {
        return _splitReasonText(value);
      }
    }
    return const [];
  }

  static String _reasonText(dynamic value) {
    if (value == null) return '';
    if (value is String) return value.trim();
    if (value is Map) {
      return Json.str(
        value['reasonName'] ??
            value['reason'] ??
            value['label'] ??
            value['name'] ??
            value['value'],
      ).trim();
    }
    return value.toString().trim();
  }

  static List<String> _splitReasonText(String value) => value
      .split(RegExp(r'[,;|]'))
      .map((part) => part.trim())
      .where((part) => part.isNotEmpty)
      .toList();

  static Map<String, dynamic> _embeddedCancellation(
    Map<String, dynamic> json,
    Map<String, dynamic>? registrationDetails,
    Map<String, dynamic>? replacementDetails,
    Map<String, dynamic>? updateDetails,
  ) {
    final topLevel = json['cancellationDetails'];
    if (topLevel is Map) return Map<String, dynamic>.from(topLevel);
    final fromReg = registrationDetails?['cancellationDetails'];
    if (fromReg is Map) return Map<String, dynamic>.from(fromReg);
    final fromRep = replacementDetails?['cancellationDetails'];
    if (fromRep is Map) return Map<String, dynamic>.from(fromRep);
    final fromUpd = updateDetails?['cancellationDetails'];
    if (fromUpd is Map) return Map<String, dynamic>.from(fromUpd);
    return const {};
  }
}
