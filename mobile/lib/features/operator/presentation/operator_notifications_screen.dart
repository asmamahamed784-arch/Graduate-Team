import 'package:flutter/material.dart';

import '../../notifications/presentation/notifications_screen.dart';

/// Operator notifications tab — reuses the citizen [NotificationsScreen].
class OperatorNotificationsScreen extends StatelessWidget {
  const OperatorNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) => const NotificationsScreen();
}
