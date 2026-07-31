import '../../core/utils/json_utils.dart';
import '../../core/utils/role_utils.dart';

/// Maps `publicUserPayload` from `backend/controllers/authController.js`.
class AppUser {
  const AppUser({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    required this.status,
    this.fullName = '',
    this.email,
    this.phone = '',
    this.nationalId = '',
    this.nationalIdStatus = 'NOT_STARTED',
    this.cardSerialNumber = '',
    this.cardStatus = 'NOT_ISSUED',
    this.cardIssueDate,
    this.cardExpiryDate,
    this.replacementCount = 0,
    this.maritalStatus = '',
    this.dateOfBirth = '',
    this.address = '',
    this.centerId,
    this.mustChangePassword = false,
    this.createdAt,
    this.summary,
  });

  final String id;
  final String username;
  final String name;
  final String fullName;
  final String role;
  final String status;
  final String? email;
  final String phone;
  final String nationalId;
  final String nationalIdStatus;
  final String cardSerialNumber;
  final String cardStatus;
  final DateTime? cardIssueDate;
  final DateTime? cardExpiryDate;
  final int replacementCount;
  final String maritalStatus;
  final String dateOfBirth;
  final String address;
  final String? centerId;
  final bool mustChangePassword;
  final DateTime? createdAt;
  final CitizenSummary? summary;

  bool get isCitizen => roleIsCitizen(role);
  bool get isAdmin => roleIsAdmin(role);
  bool get isOperator => roleIsOperator(role);
  bool get hasPhone => phone.trim().isNotEmpty;
  bool get hasIssuedId =>
      nationalIdStatus.toUpperCase() == 'COMPLETED' || cardStatus.toUpperCase() == 'ISSUED';

  String get displayName {
    if (fullName.trim().isNotEmpty) return fullName.trim();
    if (name.trim().isNotEmpty) return name.trim();
    return username;
  }

  AppUser copyWith({String? role}) => AppUser(
        id: id,
        username: username,
        name: name,
        role: role != null ? normalizeRole(role) : this.role,
        status: status,
        fullName: fullName,
        email: email,
        phone: phone,
        nationalId: nationalId,
        nationalIdStatus: nationalIdStatus,
        cardSerialNumber: cardSerialNumber,
        cardStatus: cardStatus,
        cardIssueDate: cardIssueDate,
        cardExpiryDate: cardExpiryDate,
        replacementCount: replacementCount,
        maritalStatus: maritalStatus,
        dateOfBirth: dateOfBirth,
        address: address,
        centerId: centerId,
        mustChangePassword: mustChangePassword,
        createdAt: createdAt,
        summary: summary,
      );

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: Json.idOf(json),
        username: Json.str(json['username']),
        name: Json.str(json['name']),
        fullName: Json.str(json['fullName']),
        // Always normalize casing/aliases (ADMIN, Admin, USER → citizen, …).
        // Some payloads nest role under account/profile — check fallbacks.
        role: normalizeRole(
          Json.str(
            json['role'] ??
                json['userRole'] ??
                json['accountRole'] ??
                (json['account'] is Map ? json['account']['role'] : null),
            'citizen',
          ),
        ),
        status: Json.str(json['status'], 'active'),
        email: Json.strOrNull(json['email']),
        phone: Json.str(json['phone']),
        nationalId: Json.str(json['nationalId']),
        nationalIdStatus: Json.str(json['nationalIdStatus'], 'NOT_STARTED'),
        cardSerialNumber: Json.str(json['cardSerialNumber']),
        cardStatus: Json.str(json['cardStatus'], 'NOT_ISSUED'),
        cardIssueDate: Json.date(json['cardIssueDate']),
        cardExpiryDate: Json.date(json['cardExpiryDate']),
        replacementCount: Json.intOf(json['replacementCount']),
        maritalStatus: Json.str(json['maritalStatus']),
        dateOfBirth: Json.str(json['dateOfBirth']),
        address: Json.str(json['address']),
        centerId: Json.strOrNull(Json.refId(json['center'])),
        mustChangePassword: Json.boolOf(json['mustChangePassword']),
        createdAt: Json.date(json['createdAt']),
        summary: json['citizenSummary'] is Map
            ? CitizenSummary.fromJson(Json.map(json['citizenSummary']))
            : null,
      );
}

/// The `citizenSummary` block the dashboard renders.
class CitizenSummary {
  const CitizenSummary({
    this.fullName = '',
    this.nationalIdNumber = '',
    this.nationalIdStatus = '',
    this.maritalStatus = '',
    this.accountStatus = '',
    this.registrationDate = '',
    this.issueDate,
    this.expiryDate,
    this.districtName = '',
    this.centerName = '',
  });

  final String fullName;
  final String nationalIdNumber;
  final String nationalIdStatus;
  final String maritalStatus;
  final String accountStatus;
  final String registrationDate;
  final DateTime? issueDate;
  final DateTime? expiryDate;
  final String districtName;
  final String centerName;

  factory CitizenSummary.fromJson(Map<String, dynamic> json) => CitizenSummary(
        fullName: Json.str(json['fullName']),
        nationalIdNumber: Json.str(json['nationalIdNumber']),
        nationalIdStatus: Json.str(json['nationalIdStatus']),
        maritalStatus: Json.str(json['maritalStatus']),
        accountStatus: Json.str(json['accountStatus']),
        registrationDate: Json.str(json['registrationDate']),
        issueDate: Json.date(json['issueDate']),
        expiryDate: Json.date(json['expiryDate']),
        districtName: Json.str(json['districtName']),
        centerName: Json.str(json['centerName']),
      );
}
