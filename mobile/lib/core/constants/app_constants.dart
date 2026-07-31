/// Domain constants copied from the backend and the web frontend so the
/// mobile app speaks the exact same vocabulary as the rest of the system.
class AppConstants {
  const AppConstants._();

  static const String appName = 'NQS National ID';
  static const String appTagline = 'National Queue System';

  static const String citizenRole = 'citizen';
  static const String operatorRole = 'operator';
  static const String superOperatorRole = 'super_operator';
  static const String centerManagerRole = 'center_manager';
  static const String adminRole = 'admin';
  static const String superAdminRole = 'super_admin';
  static const String userManagerRole = 'user_manager';

  static const Set<String> adminRoles = {
    adminRole,
    superAdminRole,
    userManagerRole,
  };

  static const Set<String> operatorRoles = {
    operatorRole,
    superOperatorRole,
    centerManagerRole,
  };

  /// Service names the backend seeds, used to route to the dedicated forms.
  static const String newIdServiceName = 'National ID Registration';
  static const String updateInfoServiceName = 'Update National ID Information';
  static const String replaceIdServiceName = 'Replace Lost National ID';
  static const String renewIdServiceName = 'Renew National ID';
}

/// `Ticket.requestType` values (`backend/prisma/schema.prisma`).
class RequestTypes {
  const RequestTypes._();

  static const String newNationalId = 'new_national_id';
  static const String lostReplacement = 'lost_replacement';
  static const String updateInformation = 'update_information';
  static const String serviceRequest = 'service_request';

  static String label(String? value) {
    switch (value) {
      case newNationalId:
        return 'New National ID';
      case lostReplacement:
        return 'Replace Lost ID';
      case updateInformation:
        return 'Update Information';
      case serviceRequest:
        return 'Service Request';
      default:
        return 'Request';
    }
  }
}

/// `Ticket.status` values used by the queue.
class TicketStatus {
  const TicketStatus._();

  static const String waiting = 'Waiting';
  static const String beingServed = 'Being Served';
  static const String onHold = 'On Hold';
  static const String completed = 'Completed';
  static const String cancelled = 'Cancelled';
  static const String pending = 'Pending';

  static const Set<String> openStatuses = {waiting, beingServed, onHold, pending};
  static const Set<String> closedStatuses = {completed, cancelled};
}

/// `Ticket.requestStatus` values used by the application workflow.
class RequestStatus {
  const RequestStatus._();

  static const String pending = 'Pending';
  static const String underReview = 'Under Review';
  static const String approved = 'Approved';
  static const String inProgress = 'In Progress';
  static const String completed = 'Completed';
  static const String cancelled = 'Cancelled';
  static const String rejected = 'Rejected';
  static const String resubmissionRequired = 'Resubmission Required';
  static const String needsCorrection = 'NEEDS_CORRECTION';
  static const String resubmitted = 'RESUBMITTED';
}

/// `purpose` values accepted by `POST /api/otp/request`.
class OtpPurpose {
  const OtpPurpose._();

  static const String newIdBooking = 'new_id_booking';
  static const String updateInformation = 'update_information';
  static const String replaceLostId = 'replace_lost_id';
  static const String completeService = 'complete_service';
  static const String forgotPassword = 'forgot_password';
  static const String login = 'login';
}
