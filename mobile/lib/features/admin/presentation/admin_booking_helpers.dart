import '../../../core/constants/app_constants.dart';
import '../../../shared/models/appointment.dart';

/// Resolves the workflow status shown in admin lists.
String adminBookingStatus(Appointment appointment) =>
    appointment.requestStatus.isNotEmpty ? appointment.requestStatus : appointment.status;

bool matchesAdminBookingFilter(Appointment appointment, String filter) {
  if (filter.isEmpty || filter == 'all') return true;

  final status = adminBookingStatus(appointment);
  final ticketStatus = appointment.status;

  switch (filter) {
    case 'pending':
      return status == RequestStatus.pending ||
          status == RequestStatus.underReview ||
          status == RequestStatus.resubmissionRequired;
    case 'waiting':
      return ticketStatus == TicketStatus.waiting ||
          status == RequestStatus.approved ||
          ticketStatus == TicketStatus.beingServed;
    case 'completed':
      return status == RequestStatus.completed ||
          ticketStatus == TicketStatus.completed;
    case 'lost':
      return appointment.requestType == RequestTypes.lostReplacement;
    case 'update':
      return appointment.requestType == RequestTypes.updateInformation;
    default:
      return status.toLowerCase() == filter.toLowerCase() ||
          ticketStatus.toLowerCase() == filter.toLowerCase();
  }
}

bool matchesAdminSearch(Appointment appointment, String query) {
  if (query.trim().isEmpty) return true;
  final q = query.trim().toLowerCase();
  return appointment.reference.toLowerCase().contains(q) ||
      appointment.citizenName.toLowerCase().contains(q) ||
      appointment.serviceName.toLowerCase().contains(q) ||
      appointment.centerName.toLowerCase().contains(q) ||
      appointment.nationalIdNumber.toLowerCase().contains(q);
}

bool isQueueBooking(Appointment appointment) {
  final status = appointment.status;
  return status == TicketStatus.waiting || status == TicketStatus.beingServed;
}
