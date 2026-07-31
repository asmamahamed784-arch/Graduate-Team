import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_service.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/queue_status.dart';
import '../../appointments/data/booking_repository.dart';
import '../data/queue_repository.dart';

/// Live status for one ticket reference.
///
/// Combines a 15 second poll (the same cadence as the web `TrackQueue` page)
/// with Socket.IO `ticketUpdate` pushes, so the position stays fresh even when
/// the socket cannot connect.
///
/// Auto-disposed so the timer and the socket subscription stop when the screen
/// closes; Riverpod 3 keeps providers alive unless asked otherwise.
final queueTrackingProvider = StreamProvider.family<QueueStatus, String>(
  isAutoDispose: true,
  (ref, reference) {
    final repository = ref.watch(queueRepositoryProvider);
    final realtime = ref.watch(realtimeServiceProvider);
    final controller = StreamController<QueueStatus>();

    var hasEmitted = false;

    Future<void> fetch() async {
      try {
        final status = await repository.track(reference);
        if (!controller.isClosed) {
          hasEmitted = true;
          controller.add(status);
        }
      } catch (error, stackTrace) {
        // Once a value is on screen a transient failure should not replace it
        // with a full-screen error.
        if (!hasEmitted && !controller.isClosed) {
          controller.addError(error, stackTrace);
        }
      }
    }

    fetch();
    final timer = Timer.periodic(const Duration(seconds: 15), (_) => fetch());
    final unsubscribe = realtime.onTicketUpdate(reference, fetch);

    ref.onDispose(() {
      timer.cancel();
      unsubscribe();
      controller.close();
    });

    return controller.stream;
  },
);

/// Ticket QR rendered by `GET /api/qr/generate?text=<ref>`, decoded from the
/// `data:image/png;base64,...` string the backend returns.
final ticketQrProvider = FutureProvider.family<Uint8List?, String>(
  isAutoDispose: true,
  (ref, reference) async {
    final dataUrl = await ref.watch(bookingRepositoryProvider).qrDataUrl(reference);
    return Formatters.decodeDataUrl(dataUrl);
  },
);
