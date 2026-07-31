import '../../core/constants/app_constants.dart';
import '../../core/utils/json_utils.dart';

/// `GET /api/services` item.
class ServiceModel {
  const ServiceModel({
    required this.id,
    required this.name,
    this.description = '',
    this.category = 'General',
    this.duration = 15,
    this.requirements = const [],
    this.priority = 'Medium',
    this.status = 'Active',
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final int duration;
  final List<String> requirements;
  final String priority;
  final String status;

  bool get isActive => status.toLowerCase() == 'active';

  /// Which dedicated form the service opens, matching the web app's
  /// `serviceRouting.js` mapping.
  String get requestType {
    final lower = name.toLowerCase();
    if (lower.contains('replace') || lower.contains('lost')) {
      return RequestTypes.lostReplacement;
    }
    if (lower.contains('update')) return RequestTypes.updateInformation;
    if (lower.contains('registration') || lower.contains('new')) {
      return RequestTypes.newNationalId;
    }
    return RequestTypes.serviceRequest;
  }

  factory ServiceModel.fromJson(Map<String, dynamic> json) => ServiceModel(
        id: Json.idOf(json),
        name: Json.str(json['name']),
        description: Json.str(json['description']),
        category: Json.str(json['category'], 'General'),
        duration: Json.intOf(json['duration'], 15),
        requirements: Json.stringList(json['requirements']),
        priority: Json.str(json['priority'], 'Medium'),
        status: Json.str(json['status'], 'Active'),
      );
}
