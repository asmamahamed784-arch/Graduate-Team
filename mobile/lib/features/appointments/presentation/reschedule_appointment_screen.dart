import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../centers/data/center_repository.dart';
import '../application/appointments_controller.dart';
import '../application/availability_provider.dart';
import '../data/booking_repository.dart';

/// Pick a new center / date / time. Active tickets are cancelled first, then
/// the citizen is sent to book again. Cancelled correction tickets use resubmit.
class RescheduleAppointmentScreen extends ConsumerStatefulWidget {
  const RescheduleAppointmentScreen({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  ConsumerState<RescheduleAppointmentScreen> createState() =>
      _RescheduleAppointmentScreenState();
}

class _RescheduleAppointmentScreenState
    extends ConsumerState<RescheduleAppointmentScreen> {
  String? _centerId;
  DateTime? _date;
  String? _slot;
  bool _hydrated = false;
  bool _submitting = false;
  String? _error;

  void _hydrate(Appointment data) {
    if (_hydrated) return;
    _centerId = data.centerId.isEmpty ? null : data.centerId;
    _date = Formatters.parseApiDate(data.date);
    _slot = data.timeSlot;
    _hydrated = true;
  }

  Future<void> _submit(Appointment data) async {
    if (_centerId == null || _date == null || _slot == null) {
      setState(() => _error = 'Select center, date and time.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      if (data.isCancelled || data.needsResubmission) {
        final details = <String, dynamic>{
          'centerId': _centerId,
          'date': Formatters.apiDate(_date!),
          'timeSlot': _slot,
        };
        if (data.registrationDetails != null) {
          details['registrationDetails'] = {
            ...data.registrationDetails!,
            'appointmentDate': Formatters.apiDate(_date!),
            'appointmentTime': _slot,
          };
        } else if (data.replacementDetails != null) {
          details['replacementDetails'] = {...data.replacementDetails!};
        } else if (data.updateDetails != null) {
          details['updateDetails'] = {...data.updateDetails!};
        }

        await ref
            .read(appointmentsControllerProvider.notifier)
            .resubmit(data.id, details);
        if (!mounted) return;
        showAppSnackBar(context, 'Appointment rescheduled.');
        context.go(AppRoutes.appointmentDetail(data.id));
        return;
      }

      // Active appointment: cancel, then open a fresh booking for the same service.
      await ref.read(appointmentsControllerProvider.notifier).cancel(
            data.id,
            reason:
                'Reschedule to ${Formatters.readableDate(Formatters.apiDate(_date!))} $_slot',
          );
      if (!mounted) return;
      showAppSnackBar(
        context,
        'Previous slot cancelled. Book your new appointment.',
      );
      if (data.serviceId.isNotEmpty) {
        context.go(AppRoutes.book(data.serviceId));
      } else {
        context.go(AppRoutes.services);
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_rescheduleAppointmentProvider(widget.appointmentId));

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Reschedule appointment')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(
            _rescheduleAppointmentProvider(widget.appointmentId),
          ),
        ),
        data: (data) {
          _hydrate(data);
          final now = DateTime.now();
          final start = DateTime(now.year, now.month, now.day);
          final query = _centerId == null
              ? null
              : (
                  centerId: _centerId!,
                  start: Formatters.apiDate(start),
                  end: Formatters.apiDate(
                    start.add(const Duration(days: kBookingWindowDays)),
                  ),
                );

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      data.reference,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      data.isCancelled || data.needsResubmission
                          ? 'Choose a new slot and resubmit this request.'
                          : 'Your current slot will be cancelled, then you can book the new time.',
                      style: const TextStyle(
                        color: AppColors.muted,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const SectionHeader(title: 'New appointment'),
              SectionCard(
                child: Column(
                  children: [
                    Consumer(
                      builder: (context, ref, _) {
                        final centers = ref.watch(centersProvider);
                        return centers.when(
                          loading: () => const LinearProgressIndicator(),
                          error: (_, __) => const Text('Could not load centers.'),
                          data: (all) {
                            final active =
                                all.where((c) => c.isActive).toList();
                            return DropdownButtonFormField<String>(
                              initialValue: active.any((c) => c.id == _centerId)
                                  ? _centerId
                                  : null,
                              decoration:
                                  const InputDecoration(labelText: 'Center'),
                              items: active
                                  .map(
                                    (c) => DropdownMenuItem(
                                      value: c.id,
                                      child: Text(c.name),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) => setState(() {
                                _centerId = value;
                                _date = null;
                                _slot = null;
                              }),
                            );
                          },
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    if (query != null)
                      Consumer(
                        builder: (context, ref, _) {
                          final availability =
                              ref.watch(availabilityProvider(query));
                          return availability.when(
                            loading: () => const Padding(
                              padding: EdgeInsets.all(12),
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            error: (_, __) =>
                                const Text('Could not load availability.'),
                            data: (avail) {
                              final dateKeys = avail.days.entries
                                  .where((e) => e.value.isAvailable)
                                  .map((e) => e.key)
                                  .toList()
                                ..sort();
                              return Column(
                                children: [
                                  DropdownButtonFormField<String>(
                                    initialValue: _date == null
                                        ? null
                                        : Formatters.apiDate(_date!),
                                    decoration: const InputDecoration(
                                      labelText: 'Date',
                                    ),
                                    items: dateKeys
                                        .map(
                                          (key) => DropdownMenuItem(
                                            value: key,
                                            child: Text(
                                              Formatters.readableDate(key),
                                            ),
                                          ),
                                        )
                                        .toList(),
                                    onChanged: (value) => setState(() {
                                      _date = Formatters.parseApiDate(value!);
                                      _slot = null;
                                    }),
                                  ),
                                  const SizedBox(height: 12),
                                  if (_date != null)
                                    DropdownButtonFormField<String>(
                                      initialValue: avail
                                              .slotsFor(_date!)
                                              .contains(_slot)
                                          ? _slot
                                          : null,
                                      decoration: const InputDecoration(
                                        labelText: 'Time',
                                      ),
                                      items: avail
                                          .slotsFor(_date!)
                                          .map(
                                            (s) => DropdownMenuItem(
                                              value: s,
                                              child: Text(s),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: (value) =>
                                          setState(() => _slot = value),
                                    ),
                                ],
                              );
                            },
                          );
                        },
                      ),
                  ],
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                InlineErrorBanner(message: _error!),
              ],
              const SizedBox(height: 24),
              PrimaryButton(
                label: data.isCancelled || data.needsResubmission
                    ? 'Confirm new slot'
                    : 'Cancel & book new slot',
                loading: _submitting,
                icon: Icons.event_available_rounded,
                onPressed: () => _submit(data),
              ),
            ],
          );
        },
      ),
    );
  }
}

final _rescheduleAppointmentProvider =
    FutureProvider.family<Appointment, String>((ref, id) async {
  final cached = ref.watch(appointmentByIdProvider(id));
  if (cached != null) return cached;
  return ref.watch(bookingRepositoryProvider).byReference(id);
});
