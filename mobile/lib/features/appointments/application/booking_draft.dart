import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';

/// A booking the citizen has filled in but not yet confirmed with an SMS code.
///
/// It is parked here while the OTP screen runs, then posted to
/// `POST /api/bookings` together with the resulting `otpToken`.
class BookingDraft {
  const BookingDraft({
    required this.serviceId,
    required this.serviceName,
    required this.requestType,
    required this.otpPurpose,
    required this.phone,
    required this.payload,
    this.centerName,
    this.date,
    this.timeSlot,
  });

  final String serviceId;
  final String serviceName;
  final String requestType;
  final String otpPurpose;
  final String phone;

  /// Request body without `otpToken`.
  final Map<String, dynamic> payload;

  final String? centerName;
  final String? date;
  final String? timeSlot;

  Map<String, dynamic> bodyWithToken(String otpToken) => {
        ...payload,
        'otpToken': otpToken,
      };

  /// Maps a request type to the OTP purpose the backend expects.
  static String purposeFor(String requestType) {
    switch (requestType) {
      case RequestTypes.lostReplacement:
        return OtpPurpose.replaceLostId;
      case RequestTypes.updateInformation:
        return OtpPurpose.updateInformation;
      default:
        return OtpPurpose.newIdBooking;
    }
  }
}

class BookingDraftController extends Notifier<BookingDraft?> {
  @override
  BookingDraft? build() => null;

  void set(BookingDraft draft) => state = draft;

  void clear() => state = null;
}

final bookingDraftProvider =
    NotifierProvider<BookingDraftController, BookingDraft?>(BookingDraftController.new);
