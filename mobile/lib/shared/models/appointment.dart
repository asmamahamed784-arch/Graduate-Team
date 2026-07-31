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
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// An update-information request has no center, date or slot.
  bool get hasAppointmentSlot => date.trim().isNotEmpty && requestType != RequestTypes.updateInformation;

  bool get isActive =>
      !TicketStatus.closedStatuses.contains(status) &&
      requestStatus != RequestStatus.cancelled &&
      requestStatus != RequestStatus.rejected;

  bool get isCancelled =>
      status == TicketStatus.cancelled || requestStatus == RequestStatus.cancelled;

  bool get needsResubmission =>
      requestStatus == RequestStatus.resubmissionRequired ||
      requestStatus == RequestStatus.needsCorrection;

  bool get isTrackable => hasAppointmentSlot && isActive;

  /// The backend lets a citizen cancel only within one hour of creation
  /// (`bookingController.cancelBooking`), so the button is hidden after that.
  bool get canCancel {
    if (!isActive) return false;
    const cancellable = {TicketStatus.pending, TicketStatus.waiting, 'Scheduled'};
    if (!cancellable.contains(status)) return false;
    final created = createdAt;
    if (created == null) return false;
    return DateTime.now().difference(created) < const Duration(hours: 1);
  }

  /// Details block for the request type, used by detail screens.
  Map<String, dynamic> get details =>
      registrationDetails ?? replacementDetails ?? updateDetails ?? const {};

  String get requestTypeLabel => RequestTypes.label(requestType);

  factory Appointment.fromJson(Map<String, dynamic> json) {
    final service = json['service'];
    final center = json['center'];
    return Appointment(
      id: Json.idOf(json),
      reference: Json.str(json['ref']),
      status: Json.str(json['status'], TicketStatus.waiting),
      requestType: Json.str(json['requestType'], RequestTypes.newNationalId),
      requestStatus: Json.str(json['requestStatus'], RequestStatus.pending),
      serviceId: Json.refId(service),
      serviceName: Json.refName(service),
      serviceDuration: service is Map ? Json.intOf(service['duration'], 15) : 15,
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
      registrationDetails: Json.mapOrNull(json['registrationDetails']),
      replacementDetails: Json.mapOrNull(json['replacementDetails']),
      updateDetails: Json.mapOrNull(json['updateDetails']),
      createdAt: Json.date(json['createdAt']),
      updatedAt: Json.date(json['updatedAt']),
    );
  }
}
