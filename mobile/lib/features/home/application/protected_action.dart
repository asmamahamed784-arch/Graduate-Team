import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../shared/models/service.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../appointments/application/appointments_controller.dart';
import '../../auth/application/auth_controller.dart';
import '../../services/data/service_repository.dart';

/// A tap that requires a signed-in citizen. Kept as a token (not a raw
/// route) because [newRegistration]/[updateInformation]/[lostReplacement]
/// pick their real destination from the citizen's *existing* appointments,
/// which are only known once they are actually signed in. The token rides
/// through Login/Register's `resume` query parameter so the exact same
/// decision runs again — with real data this time — right after sign-in.
enum ProtectedAction {
  newRegistration,
  updateInformation,
  lostReplacement,
  trackQueue,
  myAppointments,
  notifications,
  profile;

  String get token => name;

  static ProtectedAction? fromToken(String? token) {
    for (final action in values) {
      if (action.token == token) return action;
    }
    return null;
  }
}

/// True and lets the caller proceed when the citizen is already signed in.
/// Otherwise pushes Login carrying [action]'s resume token and returns
/// false — the caller should stop; [runProtectedAction] fires again
/// automatically once sign-in succeeds.
bool ensureSignedIn(BuildContext context, WidgetRef ref, ProtectedAction action) {
  final auth = ref.read(authControllerProvider);
  if (auth.isAuthenticated) return true;
  context.push(
    Uri(
      path: AppRoutes.login,
      queryParameters: {'resume': action.token},
    ).toString(),
  );
  return false;
}

/// After a successful sign-in (direct, or via the OTP second factor),
/// continues to whatever the citizen was trying to reach: a specific
/// [ProtectedAction] token, a plain path the router's own auth gate
/// remembered, or Home if neither is present.
Future<void> resumeAfterAuth(
  BuildContext context,
  WidgetRef ref, {
  String? resumeToken,
  String? redirectTo,
}) async {
  final action = ProtectedAction.fromToken(resumeToken);
  if (action != null) {
    await runProtectedAction(context, ref, action);
    return;
  }
  if (redirectTo != null && redirectTo.isNotEmpty) {
    context.go(redirectTo);
    return;
  }
  context.go(AppRoutes.home);
}

/// Runs [action] for an already-signed-in citizen. Awaits fresh
/// appointments/services data first so the New-Registration /
/// Update-Information / Lost-ID routing decisions never run on stale
/// (or, right after login, not-yet-loaded) data.
Future<void> runProtectedAction(
  BuildContext context,
  WidgetRef ref,
  ProtectedAction action,
) async {
  switch (action) {
    case ProtectedAction.newRegistration:
      await _openService(context, ref, AppConstants.newIdServiceName);
    case ProtectedAction.updateInformation:
      await _openInfoOnly(context, ref, RequestTypes.updateInformation);
    case ProtectedAction.lostReplacement:
      await _openInfoOnly(context, ref, RequestTypes.lostReplacement);
    case ProtectedAction.trackQueue:
      // Not a shell branch — always pushed with its own back button,
      // whether reached from the bottom tab, the drawer or here.
      context.push(AppRoutes.track);
    case ProtectedAction.myAppointments:
      context.go(AppRoutes.appointments);
    case ProtectedAction.notifications:
      context.go(AppRoutes.notifications);
    case ProtectedAction.profile:
      context.go(AppRoutes.profile);
  }
}

Future<void> _openService(
  BuildContext context,
  WidgetRef ref,
  String serviceName,
) async {
  await ref.read(servicesProvider.future);
  await ref.read(appointmentsControllerProvider.future);
  if (!context.mounted) return;

  final services = ref.read(activeServicesProvider);
  final match = services.where(
    (service) => _matchesService(service, serviceName),
  );
  if (match.isEmpty) {
    showAppSnackBar(context, 'This service is not available right now.', isError: true);
    return;
  }
  final openNew = ref.read(activeNewRegistrationProvider);
  if (openNew != null && match.first.requestType == RequestTypes.newNationalId) {
    context.push(AppRoutes.appointmentDetail(openNew.id));
    return;
  }
  context.push(AppRoutes.book(match.first.id));
}

Future<void> _openInfoOnly(
  BuildContext context,
  WidgetRef ref,
  String requestType,
) async {
  await ref.read(servicesProvider.future);
  await ref.read(appointmentsControllerProvider.future);
  if (!context.mounted) return;

  final services = ref.read(activeServicesProvider);
  final match = services.where((service) => service.requestType == requestType);
  if (match.isEmpty) {
    showAppSnackBar(context, 'This service is not available right now.', isError: true);
    return;
  }
  final completedRegistration = ref.read(completedNewRegistrationProvider);
  if (completedRegistration == null) {
    showAppSnackBar(
      context,
      'Complete your New Registration first. Update and Lost ID open after it is marked Completed.',
      isError: true,
    );
    return;
  }
  context.push(AppRoutes.book(match.first.id));
}

bool _matchesService(ServiceModel service, String serviceName) {
  final name = service.name.toLowerCase();
  final target = serviceName.toLowerCase();
  return name == target ||
      name.contains(target.split(' ').first.toLowerCase());
}
