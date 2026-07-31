import '../../../core/utils/json_utils.dart';

class AdminDashboardStats {
  const AdminDashboardStats({
    this.totalCitizens = 0,
    this.totalUsers = 0,
    this.activeOperators = 0,
    this.serviceCenters = 0,
    this.waitingQueue = 0,
    this.lostIdRequests = 0,
    this.updateRequests = 0,
    this.pendingOperators = 0,
    this.completedServices = 0,
    this.cancelledAppointments = 0,
    this.recentActivities = const [],
  });

  final int totalCitizens;
  final int totalUsers;
  final int activeOperators;
  final int serviceCenters;
  final int waitingQueue;
  final int lostIdRequests;
  final int updateRequests;
  final int pendingOperators;
  final int completedServices;
  final int cancelledAppointments;
  final List<Map<String, dynamic>> recentActivities;

  factory AdminDashboardStats.fromJson(Map<String, dynamic> json) =>
      AdminDashboardStats(
        totalCitizens: Json.intOf(json['totalCitizens'] ?? json['totalUsers']),
        totalUsers: Json.intOf(json['totalUsers'] ?? json['totalCitizens']),
        activeOperators: Json.intOf(json['activeOperators']),
        serviceCenters: Json.intOf(
          json['serviceCenters'] ?? json['totalServiceCenters'],
        ),
        waitingQueue: Json.intOf(json['waitingQueue'] ?? json['activeQueues']),
        lostIdRequests: Json.intOf(json['lostIdRequests']),
        updateRequests: Json.intOf(json['updateRequests']),
        pendingOperators: Json.intOf(json['pendingOperators']),
        completedServices: Json.intOf(json['completedServices']),
        cancelledAppointments: Json.intOf(json['cancelledAppointments']),
        recentActivities: Json.mapList(json['recentActivities']),
      );
}

class AdminUserRow {
  const AdminUserRow({
    required this.id,
    required this.name,
    required this.username,
    required this.role,
    required this.status,
    this.phone = '',
    this.email = '',
    this.nationalId = '',
  });

  final String id;
  final String name;
  final String username;
  final String role;
  final String status;
  final String phone;
  final String email;
  final String nationalId;

  factory AdminUserRow.fromJson(Map<String, dynamic> json) => AdminUserRow(
        id: Json.idOf(json),
        name: Json.str(json['fullName']).isNotEmpty
            ? Json.str(json['fullName'])
            : Json.str(json['name'], Json.str(json['username'])),
        username: Json.str(json['username']),
        role: Json.str(json['role'], 'citizen'),
        status: Json.str(json['status'], 'active'),
        phone: Json.str(json['phone']),
        email: Json.str(json['email']),
        nationalId: Json.str(json['nationalId']),
      );
}

class AdminOperatorRow {
  const AdminOperatorRow({
    required this.id,
    required this.name,
    required this.username,
    required this.status,
    this.centerName = '',
    this.phone = '',
    this.role = 'operator',
  });

  final String id;
  final String name;
  final String username;
  final String status;
  final String centerName;
  final String phone;
  final String role;

  bool get isActive => status.toLowerCase() == 'active';

  factory AdminOperatorRow.fromJson(Map<String, dynamic> json) => AdminOperatorRow(
        id: Json.idOf(json),
        name: Json.str(json['fullName']).isNotEmpty
            ? Json.str(json['fullName'])
            : Json.str(json['name'], Json.str(json['username'])),
        username: Json.str(json['username']),
        status: Json.str(json['status'], 'pending'),
        centerName: Json.refName(json['center']),
        phone: Json.str(json['phone']),
        role: Json.str(json['role'], 'operator'),
      );
}

class AdminSessionRow {
  const AdminSessionRow({
    required this.id,
    this.userName = '',
    this.role = '',
    this.device = '',
    this.ip = '',
    this.createdAt,
    this.lastActiveAt,
  });

  final String id;
  final String userName;
  final String role;
  final String device;
  final String ip;
  final DateTime? createdAt;
  final DateTime? lastActiveAt;

  factory AdminSessionRow.fromJson(Map<String, dynamic> json) => AdminSessionRow(
        id: Json.idOf(json),
        userName: Json.refName(json['user'], Json.str(json['username'])),
        role: Json.str(json['role']),
        device: Json.str(json['device'] ?? json['userAgent']),
        ip: Json.str(json['ip'] ?? json['ipAddress']),
        createdAt: Json.date(json['createdAt']),
        lastActiveAt: Json.date(json['lastActiveAt'] ?? json['updatedAt']),
      );
}

class AdminActivityRow {
  const AdminActivityRow({
    required this.id,
    this.action = '',
    this.actor = '',
    this.details = '',
    this.createdAt,
  });

  final String id;
  final String action;
  final String actor;
  final String details;
  final DateTime? createdAt;

  factory AdminActivityRow.fromJson(Map<String, dynamic> json) => AdminActivityRow(
        id: Json.idOf(json),
        action: Json.str(json['action'] ?? json['type'] ?? json['event']),
        actor: Json.refName(json['user'], Json.str(json['actor'] ?? json['username'])),
        details: Json.str(json['details'] ?? json['message'] ?? json['description']),
        createdAt: Json.date(json['createdAt'] ?? json['time']),
      );
}
