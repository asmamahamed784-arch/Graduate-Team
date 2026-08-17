import '../../core/utils/json_utils.dart';

/// `GET /api/notifications` item.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.description,
    this.category = 'System',
    this.notificationType = '',
    this.referenceNumber = '',
    this.requestType = '',
    this.relatedEntity = '',
    this.read = false,
    this.timestamp,
    this.cancellationReason = '',
  });

  final String id;
  final String title;
  final String description;
  final String category;
  final String notificationType;
  final String referenceNumber;
  final String requestType;
  final String relatedEntity;
  final bool read;
  final DateTime? timestamp;
  final String cancellationReason;

  AppNotification copyWith({bool? read}) => AppNotification(
        id: id,
        title: title,
        description: description,
        category: category,
        notificationType: notificationType,
        referenceNumber: referenceNumber,
        requestType: requestType,
        relatedEntity: relatedEntity,
        read: read ?? this.read,
        timestamp: timestamp,
        cancellationReason: cancellationReason,
      );

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: Json.idOf(json),
        title: Json.str(json['title'], 'Notification'),
        description: Json.str(json['desc'], Json.str(json['message'])),
        category: Json.str(json['category'], 'System'),
        notificationType: Json.str(json['notificationType']),
        referenceNumber: Json.str(json['referenceNumber']),
        requestType: Json.str(json['requestType']),
        relatedEntity: Json.str(
          json['relatedEntity'],
          Json.str(json['ticketId'], Json.str(json['appointmentId'])),
        ),
        read: Json.boolOf(json['read']),
        timestamp: Json.date(json['timestamp']),
        cancellationReason: Json.str(json['cancellationReason']),
      );
}
