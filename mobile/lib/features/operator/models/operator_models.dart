import '../../../core/constants/app_constants.dart';
import '../../../core/utils/json_utils.dart';
import '../../../shared/models/appointment.dart';

class OperatorTodayStats {
  const OperatorTodayStats({
    this.pending = 0,
    this.waiting = 0,
    this.nowServing = 0,
    this.completed = 0,
    this.cancelled = 0,
    this.noShow = 0,
    this.totalAppointments = 0,
  });

  final int pending;
  final int waiting;
  final int nowServing;
  final int completed;
  final int cancelled;
  final int noShow;
  final int totalAppointments;

  factory OperatorTodayStats.fromJson(Map<String, dynamic>? json) {
    if (json == null || json.isEmpty) return const OperatorTodayStats();
    return OperatorTodayStats(
      pending: Json.intOf(json['pending']),
      waiting: Json.intOf(json['waiting']),
      nowServing: Json.intOf(json['nowServing']),
      completed: Json.intOf(json['completed']),
      cancelled: Json.intOf(json['cancelled']),
      noShow: Json.intOf(json['noShow']),
      totalAppointments: Json.intOf(json['totalAppointments']),
    );
  }
}

class OperatorDashboardData {
  const OperatorDashboardData({
    this.centerName = '',
    this.ticketsWaitingCount = 0,
    this.currentlyServing,
    this.servedTodayCount = 0,
    this.todayStats = const OperatorTodayStats(),
    this.ticketsWaiting = const [],
    this.servedToday = const [],
    this.pendingCorrections = const [],
    this.avgServiceTime = '--',
    this.allCenterTickets = const [],
  });

  final String centerName;
  final int ticketsWaitingCount;
  final Appointment? currentlyServing;
  final int servedTodayCount;
  final OperatorTodayStats todayStats;
  final List<Appointment> ticketsWaiting;
  final List<Appointment> servedToday;
  final List<Appointment> pendingCorrections;
  final String avgServiceTime;
  final List<Appointment> allCenterTickets;

  int get pendingCorrectionsCount => pendingCorrections.length;

  factory OperatorDashboardData.fromJson(Map<String, dynamic> json) {
    final todayRaw = json['todayStats'];
    final todayStats = todayRaw is Map
        ? OperatorTodayStats.fromJson(Map<String, dynamic>.from(todayRaw))
        : OperatorTodayStats.fromJson(
            json['centerStats'] is Map
                ? Map<String, dynamic>.from(
                    (json['centerStats'] as Map)['today'] as Map? ?? const {},
                  )
                : null,
          );

    final waiting = _appointmentsFrom(json['ticketsWaiting']);
    final served = _appointmentsFrom(json['servedToday']);
    final all = _appointmentsFrom(
      json['allCenterTickets'] ?? json['tickets'] ?? json['allTickets'],
    );

    final corrections = all.where((ticket) => ticket.needsResubmission).toList();

    return OperatorDashboardData(
      centerName: Json.str(json['centerName']),
      ticketsWaitingCount: Json.intOf(
        json['ticketsWaitingCount'],
        waiting.length,
      ),
      currentlyServing: _appointmentOrNull(json['currentlyServing']),
      servedTodayCount: Json.intOf(json['servedTodayCount'], served.length),
      todayStats: todayStats,
      ticketsWaiting: waiting,
      servedToday: served,
      pendingCorrections: corrections,
      avgServiceTime: Json.str(json['avgServiceTime'], '--'),
      allCenterTickets: all,
    );
  }
}

class OperatorQueueData {
  const OperatorQueueData({
    this.centerName = '',
    this.currentlyServing,
    this.waitingTickets = const [],
    this.onHoldTickets = const [],
    this.allActiveTickets = const [],
  });

  final String centerName;
  final Appointment? currentlyServing;
  final List<Appointment> waitingTickets;
  final List<Appointment> onHoldTickets;
  final List<Appointment> allActiveTickets;

  factory OperatorQueueData.fromJson(Map<String, dynamic> json) {
    final waiting = _appointmentsFrom(json['waitingTickets']);
    final onHold = _appointmentsFrom(json['onHoldTickets']);
    final all = _appointmentsFrom(json['allActiveTickets']);

    return OperatorQueueData(
      centerName: Json.str(json['centerName']),
      currentlyServing: _appointmentOrNull(json['currentlyServing']),
      waitingTickets: waiting,
      onHoldTickets: onHold,
      allActiveTickets: all.isNotEmpty
          ? all
          : [...waiting, ...onHold],
    );
  }
}

/// Whether operator actions like cancel should be blocked.
bool operatorTicketIsCompleted(Appointment ticket) {
  return ticket.status == TicketStatus.completed ||
      ticket.requestStatus == RequestStatus.completed;
}

/// Whether cancel is allowed for an operator-facing ticket.
bool operatorCanCancel(Appointment ticket) {
  if (operatorTicketIsCompleted(ticket)) return false;
  if (ticket.isCancelled) return false;
  return TicketStatus.openStatuses.contains(ticket.status) ||
      ticket.status == TicketStatus.beingServed ||
      ticket.status == TicketStatus.onHold;
}

List<Appointment> _appointmentsFrom(dynamic value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((row) => Appointment.fromJson(Map<String, dynamic>.from(row)))
      .toList();
}

Appointment? _appointmentOrNull(dynamic value) {
  if (value is! Map || value.isEmpty) return null;
  return Appointment.fromJson(Map<String, dynamic>.from(value));
}

/// Common correction reasons mirrored from the backend catalog.
const operatorCorrectionReasonOptions = [
  'First name is incorrect',
  'Last name is incorrect',
  'Date of birth is incorrect',
  'Mother\'s name is incorrect',
  'Address is incorrect',
  'Uploaded document is unclear',
  'Photo does not meet requirements',
  'National ID number is incorrect',
];
