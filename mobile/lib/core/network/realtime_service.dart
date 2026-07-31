import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/env.dart';

/// Thin wrapper over the Socket.IO server that `backend/server.js` runs on the
/// same port as the REST API.
///
/// Events consumed here: `ticketUpdate` (after `joinTicket`), `queueUpdate`
/// (after `joinCenter`) and `notification-{userId}`. Sockets are treated as an
/// optimisation only, every screen also polls, so a failed connection is silent.
class RealtimeService {
  RealtimeService();

  io.Socket? _socket;
  final Map<String, Set<VoidCallback>> _ticketListeners = {};
  final Set<VoidCallback> _notificationListeners = {};

  void connect({String? userId}) {
    if (!Env.enableRealtime || _socket != null) return;
    try {
      final socket = io.io(
        Env.apiBaseUrl,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .enableReconnection()
            .disableAutoConnect()
            .build(),
      );

      socket.onConnect((_) {
        for (final reference in _ticketListeners.keys) {
          socket.emit('joinTicket', reference);
        }
      });

      socket.on('ticketUpdate', (data) {
        final reference = _referenceOf(data);
        if (reference == null) {
          for (final listeners in _ticketListeners.values) {
            for (final listener in listeners) {
              listener();
            }
          }
          return;
        }
        for (final listener in _ticketListeners[reference] ?? const <VoidCallback>{}) {
          listener();
        }
      });

      if (userId != null && userId.isNotEmpty) {
        socket.on('notification-$userId', (_) => _notifyNotifications());
      }
      socket.on('notification-broadcast', (_) => _notifyNotifications());

      socket.connect();
      _socket = socket;
    } catch (error) {
      debugPrint('[NQS] realtime disabled: $error');
    }
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  /// Subscribes to updates for one ticket. Returns the unsubscribe callback.
  VoidCallback onTicketUpdate(String reference, VoidCallback listener) {
    final key = reference.toUpperCase();
    _ticketListeners.putIfAbsent(key, () => {}).add(listener);
    _socket?.emit('joinTicket', key);

    return () {
      final listeners = _ticketListeners[key];
      listeners?.remove(listener);
      if (listeners != null && listeners.isEmpty) _ticketListeners.remove(key);
    };
  }

  VoidCallback onNotification(VoidCallback listener) {
    _notificationListeners.add(listener);
    return () => _notificationListeners.remove(listener);
  }

  void _notifyNotifications() {
    for (final listener in _notificationListeners) {
      listener();
    }
  }

  String? _referenceOf(dynamic payload) {
    if (payload is Map) {
      final value = payload['ref'] ?? payload['reference'];
      if (value is String && value.isNotEmpty) return value.toUpperCase();
    }
    return null;
  }
}

final realtimeServiceProvider = Provider<RealtimeService>((ref) {
  final service = RealtimeService();
  ref.onDispose(service.disconnect);
  return service;
});
