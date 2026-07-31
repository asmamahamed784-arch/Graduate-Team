import '../../core/constants/app_constants.dart';
import '../../core/utils/json_utils.dart';

/// `GET /api/queue/track/:ref` payload.
class QueueStatus {
  const QueueStatus({
    required this.reference,
    required this.status,
    this.position = 0,
    this.peopleAhead = 0,
    this.estimatedWait = '0 min',
    this.centerName = '',
    this.serviceName = '',
    this.requestType = RequestTypes.newNationalId,
    this.requestStatus = RequestStatus.pending,
    this.appointmentDate = '',
    this.timeSlot,
    this.counter = '--',
    this.nowServing,
  });

  final String reference;
  final String status;
  final int position;
  final int peopleAhead;
  final String estimatedWait;
  final String centerName;
  final String serviceName;
  final String requestType;
  final String requestStatus;
  final String appointmentDate;
  final String? timeSlot;
  final String counter;
  final NowServing? nowServing;

  bool get isWaiting => status == TicketStatus.waiting;
  bool get isBeingServed => status == TicketStatus.beingServed;
  bool get isFinished => TicketStatus.closedStatuses.contains(status);

  factory QueueStatus.fromJson(Map<String, dynamic> json) => QueueStatus(
        reference: Json.str(json['reference']),
        status: Json.str(json['status'], TicketStatus.waiting),
        position: Json.intOf(json['position']),
        peopleAhead: Json.intOf(json['peopleAhead']),
        estimatedWait: Json.str(json['estimatedWait'], '0 min'),
        centerName: Json.str(json['center']),
        serviceName: Json.str(json['service']),
        requestType: Json.str(json['requestType'], RequestTypes.newNationalId),
        requestStatus: Json.str(json['requestStatus'], RequestStatus.pending),
        appointmentDate: Json.str(json['appointmentDate']),
        timeSlot: Json.strOrNull(json['timeSlot']),
        counter: Json.str(json['counter'], '--'),
        nowServing: json['nowServing'] is Map
            ? NowServing.fromJson(Json.map(json['nowServing']))
            : null,
      );
}

class NowServing {
  const NowServing({required this.reference, required this.counter});

  final String reference;
  final String counter;

  factory NowServing.fromJson(Map<String, dynamic> json) => NowServing(
        reference: Json.str(json['reference']),
        counter: Json.str(json['counter'], '--'),
      );
}
