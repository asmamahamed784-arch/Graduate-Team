import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/appointments_controller.dart';
import '../application/availability_provider.dart';
import '../data/booking_repository.dart';
import '../../centers/data/center_repository.dart';
import 'appointment_detail_helpers.dart';
import 'widgets/staff_cancellation_feedback.dart';

/// Citizen corrects only the fields staff marked incorrect.
class CorrectionRequiredScreen extends ConsumerStatefulWidget {
  const CorrectionRequiredScreen({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  ConsumerState<CorrectionRequiredScreen> createState() =>
      _CorrectionRequiredScreenState();
}

class _CorrectionRequiredScreenState
    extends ConsumerState<CorrectionRequiredScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _nationalId = TextEditingController();
  final _field = TextEditingController();
  final _currentValue = TextEditingController();
  final _newValue = TextEditingController();
  final _reason = TextEditingController();
  final _notes = TextEditingController();
  final _placeLost = TextEditingController();
  final _dateLost = TextEditingController();
  final _motherName = TextEditingController();
  final _address = TextEditingController();
  final _age = TextEditingController();
  final _dateOfBirth = TextEditingController();

  String? _gender;
  String? _maritalStatus;
  String? _centerId;
  DateTime? _date;
  String? _slot;
  bool _loaded = false;
  bool _submitting = false;
  String? _error;
  Appointment? _appointment;
  Map<String, String> _originalEditable = {};
  Set<String> _editableKeys = {};

  static const _maritalOptions = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];

  @override
  void dispose() {
    for (final c in [
      _fullName,
      _phone,
      _nationalId,
      _field,
      _currentValue,
      _newValue,
      _reason,
      _notes,
      _placeLost,
      _dateLost,
      _motherName,
      _address,
      _age,
      _dateOfBirth,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Set<String> _resolveEditableKeys(Appointment data) {
    final keys = <String>{};
    for (final reason in data.cancellationReasons) {
      final key = AppointmentFieldInfo.keyForReason(reason, data.details);
      if (key != null && key.trim().isNotEmpty) {
        keys.add(key);
      }
    }
    // If staff listed reasons but mapping failed, unlock nothing special —
    // fall back to common identity fields so the citizen can still correct.
    if (keys.isEmpty && data.cancellationReasons.isNotEmpty) {
      for (final reason in data.cancellationReasons) {
        final r = reason.toLowerCase();
        if (r.contains('mother')) keys.add('motherName');
        if (r.contains('age')) keys.add('age');
        if (r.contains('marital')) keys.add('maritalStatus');
        if (r.contains('full name') || r == 'name') keys.add('fullName');
        if (r.contains('phone')) keys.add('phone');
        if (r.contains('address')) keys.add('address');
        if (r.contains('gender')) keys.add('gender');
        if (r.contains('birth')) keys.add('dateOfBirth');
        if (r.contains('district')) keys.add('district');
      }
    }
    return keys;
  }

  bool _canEdit(String key) {
    if (_editableKeys.isEmpty) return true;
    if (key == 'field' ||
        key == 'currentValue' ||
        key == 'newValue' ||
        key == 'reason') {
      return _appointment?.requestType == 'update_information';
    }
    return _editableKeys.contains(key);
  }

  bool get _hasLockedFields {
    final isNewId = _appointment?.requestType == 'new_national_id';
    return (!_canEdit('fullName')) ||
        (!_canEdit('phone')) ||
        (isNewId && !_canEdit('motherName')) ||
        (isNewId && !_canEdit('age')) ||
        (isNewId && !_canEdit('maritalStatus')) ||
        (isNewId && !_canEdit('gender')) ||
        (isNewId && !_canEdit('address') && !_canEdit('fullAddress')) ||
        (isNewId && !_canEdit('dateOfBirth')) ||
        (!isNewId &&
            !_canEdit('nationalId') &&
            !_canEdit('nationalIdNumber'));
  }

  String _norm(String? value) =>
      (value ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  void _hydrate(Appointment data) {
    if (_loaded) return;
    _appointment = data;
    _editableKeys = _resolveEditableKeys(data);
    _fullName.text = data.citizenName.isNotEmpty
        ? data.citizenName
        : '${data.details['fullName'] ?? ''}';
    _nationalId.text = data.nationalIdNumber;
    final details = data.details;
    _phone.text = '${details['phone'] ?? ''}';
    _motherName.text = '${details['motherName'] ?? ''}';
    _address.text = '${details['address'] ?? details['fullAddress'] ?? ''}';
    _age.text = '${details['age'] ?? ''}';
    _dateOfBirth.text = '${details['dateOfBirth'] ?? ''}';
    _gender = details['gender']?.toString();
    final marital = details['maritalStatus']?.toString().trim().toUpperCase();
    _maritalStatus =
        marital != null && marital.isNotEmpty && _maritalOptions.contains(marital)
            ? marital
            : (marital?.isNotEmpty == true ? marital : null);
    _placeLost.text = '${details['placeLost'] ?? ''}';
    _dateLost.text = '${details['dateLost'] ?? ''}';
    _notes.text = '${details['notes'] ?? details['additionalNotes'] ?? ''}';
    if (details['changes'] is List && (details['changes'] as List).isNotEmpty) {
      final change = (details['changes'] as List).first;
      if (change is Map) {
        _field.text = '${change['field'] ?? ''}';
        _currentValue.text = '${change['currentValue'] ?? ''}';
        _newValue.text = '${change['newValue'] ?? ''}';
        _reason.text = '${change['reason'] ?? ''}';
      }
    }
    _centerId = data.centerId.isEmpty ? null : data.centerId;
    _date = Formatters.parseApiDate(data.date);
    _slot = data.timeSlot;

    _originalEditable = {
      if (_canEdit('fullName')) 'fullName': _norm(_fullName.text),
      if (_canEdit('phone')) 'phone': _norm(Validators.normalizePhone(_phone.text)),
      if (_canEdit('motherName')) 'motherName': _norm(_motherName.text),
      if (_canEdit('address') || _canEdit('fullAddress'))
        'address': _norm(_address.text),
      if (_canEdit('age')) 'age': _norm(_age.text),
      if (_canEdit('dateOfBirth')) 'dateOfBirth': _norm(_dateOfBirth.text),
      if (_canEdit('gender')) 'gender': _norm(_gender),
      if (_canEdit('maritalStatus'))
        'maritalStatus': _norm(_maritalStatus),
      if (_canEdit('nationalId') || _canEdit('nationalIdNumber'))
        'nationalId': _norm(_nationalId.text),
      if (_canEdit('placeLost')) 'placeLost': _norm(_placeLost.text),
      if (_canEdit('dateLost')) 'dateLost': _norm(_dateLost.text),
    };

    _loaded = true;
  }

  bool _isSameAsPrevious() {
    if (_originalEditable.isEmpty) return false;
    final current = <String, String>{
      if (_canEdit('fullName')) 'fullName': _norm(_fullName.text),
      if (_canEdit('phone'))
        'phone': _norm(Validators.normalizePhone(_phone.text)),
      if (_canEdit('motherName')) 'motherName': _norm(_motherName.text),
      if (_canEdit('address') || _canEdit('fullAddress'))
        'address': _norm(_address.text),
      if (_canEdit('age')) 'age': _norm(_age.text),
      if (_canEdit('dateOfBirth')) 'dateOfBirth': _norm(_dateOfBirth.text),
      if (_canEdit('gender')) 'gender': _norm(_gender),
      if (_canEdit('maritalStatus')) 'maritalStatus': _norm(_maritalStatus),
      if (_canEdit('nationalId') || _canEdit('nationalIdNumber'))
        'nationalId': _norm(_nationalId.text),
      if (_canEdit('placeLost')) 'placeLost': _norm(_placeLost.text),
      if (_canEdit('dateLost')) 'dateLost': _norm(_dateLost.text),
    };

    for (final entry in _originalEditable.entries) {
      if (current[entry.key] != entry.value) return false;
    }
    return true;
  }

  Future<void> _submit() async {
    final appointment = _appointment;
    if (appointment == null) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    if (_isSameAsPrevious()) {
      setState(() {
        _error =
            'Xogtii hore weeye. Fadlan wax ka beddel oo ku noqo — isla xogta hore lama soo celin karo.';
      });
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final body = <String, dynamic>{
        if (_centerId != null) 'centerId': _centerId,
        if (_date != null) 'date': Formatters.apiDate(_date!),
        if (_slot != null) 'timeSlot': _slot,
      };

      final type = appointment.requestType;
      if (type == 'new_national_id') {
        final next = <String, dynamic>{
          ...appointment.registrationDetails ?? {},
        };
        // Only overwrite keys the citizen was allowed to edit.
        if (_canEdit('fullName')) next['fullName'] = _fullName.text.trim();
        if (_canEdit('motherName')) next['motherName'] = _motherName.text.trim();
        if (_canEdit('phone')) {
          next['phone'] = Validators.normalizePhone(_phone.text);
        }
        if (_canEdit('address') || _canEdit('fullAddress')) {
          next['address'] = _address.text.trim();
          next['fullAddress'] = _address.text.trim();
        }
        if (_canEdit('age')) {
          final age = int.tryParse(_age.text.trim());
          if (age != null) next['age'] = age;
        }
        if (_canEdit('dateOfBirth')) {
          next['dateOfBirth'] = _dateOfBirth.text.trim();
        }
        if (_canEdit('gender') && _gender != null) next['gender'] = _gender;
        if (_canEdit('maritalStatus') && _maritalStatus != null) {
          next['maritalStatus'] = _maritalStatus;
        }
        // Strip previous cancellation payload so staff get a clean resubmit.
        next.remove('cancellationDetails');
        next.remove('cancellationReason');
        next.remove('cancellationReasons');
        next.remove('cancellationNotes');
        body['registrationDetails'] = next;
      } else if (type == 'lost_replacement' || type == 'replace_lost_id') {
        body['replacementDetails'] = {
          ...appointment.replacementDetails ?? {},
          if (_canEdit('fullName')) 'fullName': _fullName.text.trim(),
          if (_canEdit('phone'))
            'phone': Validators.normalizePhone(_phone.text),
          if (_canEdit('nationalId') || _canEdit('nationalIdNumber'))
            'nationalIdNumber': _nationalId.text.trim(),
          if (_canEdit('dateLost')) 'dateLost': _dateLost.text.trim(),
          if (_canEdit('placeLost')) 'placeLost': _placeLost.text.trim(),
          'additionalNotes': _notes.text.trim(),
        };
      } else {
        body['updateDetails'] = {
          ...appointment.updateDetails ?? {},
          if (_canEdit('fullName')) 'fullName': _fullName.text.trim(),
          if (_canEdit('phone'))
            'phone': Validators.normalizePhone(_phone.text),
          'nationalIdNumber': _nationalId.text.trim(),
          'changes': [
            {
              'field': _field.text.trim(),
              'currentValue': _currentValue.text.trim(),
              'newValue': _newValue.text.trim(),
              'reason': _reason.text.trim(),
            },
          ],
          'notes': _notes.text.trim(),
        };
      }

      await ref
          .read(appointmentsControllerProvider.notifier)
          .resubmit(appointment.id, body);

      if (!mounted) return;
      showAppSnackBar(context, 'Correction resubmitted successfully.');
      context.go(AppRoutes.appointmentDetail(appointment.id));
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  InputDecoration _decoration(String label, {required bool editable}) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: editable ? Colors.white : const Color(0xFFF3F4F6),
      suffixIcon: editable
          ? null
          : const Icon(Icons.lock_outline_rounded, size: 18),
    );
  }

  Widget _lockedField({
    required String label,
    required String value,
    IconData icon = Icons.lock_outline_rounded,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DetailRow(label: label, value: value.isEmpty ? '—' : value, icon: icon),
    );
  }

  Widget _editableText({
    required TextEditingController controller,
    required String label,
    required String keyName,
    TextInputType? keyboardType,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    final editable = _canEdit(keyName);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        readOnly: !editable,
        enabled: true,
        keyboardType: keyboardType,
        maxLines: maxLines,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: editable ? AppColors.ink : AppColors.muted,
        ),
        decoration: _decoration(label, editable: editable),
        validator: editable ? validator : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async =
        ref.watch(_correctionAppointmentProvider(widget.appointmentId));

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(title: const Text('Correction required')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(
            _correctionAppointmentProvider(widget.appointmentId),
          ),
        ),
        data: (data) {
          _hydrate(data);
          final needsSlot = data.requestType != 'update_information';
          final isNewId = data.requestType == 'new_national_id';

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (data.hasStaffCancellationFeedback) ...[
                  SectionCard(
                    child: StaffCancellationFeedback(appointment: data),
                  ),
                  const SizedBox(height: 16),
                ],

                // Editable only — fields staff marked incorrect.
                const SectionHeader(title: 'Fields to correct'),
                const SizedBox(height: 8),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _editableKeys.isEmpty
                            ? 'Update the information below, then resubmit.'
                            : 'Only these fields can be changed:',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontWeight: FontWeight.w600,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (_canEdit('fullName'))
                        _editableText(
                          controller: _fullName,
                          label: 'Full name',
                          keyName: 'fullName',
                          validator: (v) =>
                              Validators.minLength(v, 3, 'Full name'),
                        ),
                      if (_canEdit('phone'))
                        _editableText(
                          controller: _phone,
                          label: 'Phone',
                          keyName: 'phone',
                          keyboardType: TextInputType.phone,
                          validator: Validators.phone,
                        ),
                      if (_canEdit('motherName'))
                        _editableText(
                          controller: _motherName,
                          label: "Mother's name",
                          keyName: 'motherName',
                          validator: (v) =>
                              Validators.minLength(v, 3, "Mother's name"),
                        ),
                      if (_canEdit('age'))
                        _editableText(
                          controller: _age,
                          label: 'Age',
                          keyName: 'age',
                          keyboardType: TextInputType.number,
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) {
                              return 'Age is required.';
                            }
                            final n = int.tryParse(v.trim());
                            if (n == null || n < 1 || n > 120) {
                              return 'Enter a valid age.';
                            }
                            return null;
                          },
                        ),
                      if (_canEdit('dateOfBirth'))
                        _editableText(
                          controller: _dateOfBirth,
                          label: 'Date of birth',
                          keyName: 'dateOfBirth',
                          validator: (v) =>
                              Validators.notEmpty(v, 'Date of birth'),
                        ),
                      if (_canEdit('maritalStatus')) ...[
                        DropdownButtonFormField<String>(
                          initialValue: _maritalStatus != null &&
                                  _maritalOptions.contains(_maritalStatus)
                              ? _maritalStatus
                              : null,
                          decoration: _decoration(
                            'Marital status',
                            editable: true,
                          ),
                          items: _maritalOptions
                              .map(
                                (m) => DropdownMenuItem(
                                  value: m,
                                  child: Text(m),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _maritalStatus = value),
                          validator: (v) =>
                              v == null ? 'Select marital status.' : null,
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (_canEdit('gender')) ...[
                        DropdownButtonFormField<String>(
                          initialValue: _gender,
                          decoration:
                              _decoration('Gender', editable: true),
                          items: const [
                            DropdownMenuItem(
                              value: 'male',
                              child: Text('Male'),
                            ),
                            DropdownMenuItem(
                              value: 'female',
                              child: Text('Female'),
                            ),
                          ],
                          onChanged: (value) =>
                              setState(() => _gender = value),
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (_canEdit('address') || _canEdit('fullAddress'))
                        _editableText(
                          controller: _address,
                          label: 'Address',
                          keyName: 'address',
                          maxLines: 2,
                          validator: (v) =>
                              Validators.notEmpty(v, 'Address'),
                        ),
                      if (!isNewId &&
                          (_canEdit('nationalId') ||
                              _canEdit('nationalIdNumber')))
                        _editableText(
                          controller: _nationalId,
                          label: 'National ID number',
                          keyName: 'nationalId',
                        ),
                      if ((data.requestType.contains('lost') ||
                              data.requestType == 'lost_replacement') &&
                          (_canEdit('dateLost') ||
                              _canEdit('placeLost') ||
                              _editableKeys.isEmpty)) ...[
                        if (_canEdit('dateLost') || _editableKeys.isEmpty)
                          _editableText(
                            controller: _dateLost,
                            label: 'Date lost',
                            keyName: 'dateLost',
                          ),
                        if (_canEdit('placeLost') || _editableKeys.isEmpty)
                          _editableText(
                            controller: _placeLost,
                            label: 'Place lost',
                            keyName: 'placeLost',
                          ),
                      ],
                      if (data.requestType == 'update_information') ...[
                        _editableText(
                          controller: _field,
                          label: 'Field to correct',
                          keyName: 'field',
                          validator: (v) =>
                              Validators.notEmpty(v, 'Field to correct'),
                        ),
                        _editableText(
                          controller: _currentValue,
                          label: 'Current value',
                          keyName: 'currentValue',
                        ),
                        _editableText(
                          controller: _newValue,
                          label: 'New / corrected value',
                          keyName: 'newValue',
                          validator: (v) =>
                              Validators.notEmpty(v, 'Corrected value'),
                        ),
                        _editableText(
                          controller: _reason,
                          label: 'Reason',
                          keyName: 'reason',
                        ),
                      ],
                      if (_editableKeys.isNotEmpty &&
                          !_canEdit('fullName') &&
                          !_canEdit('phone') &&
                          !_canEdit('motherName') &&
                          !_canEdit('age') &&
                          !_canEdit('maritalStatus') &&
                          !_canEdit('gender') &&
                          !_canEdit('address') &&
                          !_canEdit('dateOfBirth') &&
                          data.requestType != 'update_information')
                        const Text(
                          'No matching editable fields were found for the staff reasons.',
                          style: TextStyle(
                            color: AppColors.danger,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                ),

                // Locked card — everything else read-only.
                if (_hasLockedFields) ...[
                  const SizedBox(height: 18),
                  const SectionHeader(title: 'Locked information'),
                  const SizedBox(height: 8),
                  SectionCard(
                    child: Column(
                      children: [
                        if (!_canEdit('fullName'))
                          _lockedField(
                            label: 'Full name',
                            value: _fullName.text,
                            icon: Icons.person_outline_rounded,
                          ),
                        if (!_canEdit('phone'))
                          _lockedField(
                            label: 'Phone',
                            value: _phone.text,
                            icon: Icons.phone_outlined,
                          ),
                        if (isNewId && !_canEdit('motherName'))
                          _lockedField(
                            label: "Mother's name",
                            value: _motherName.text,
                            icon: Icons.family_restroom_rounded,
                          ),
                        if (isNewId && !_canEdit('age'))
                          _lockedField(
                            label: 'Age',
                            value: _age.text,
                            icon: Icons.cake_outlined,
                          ),
                        if (isNewId && !_canEdit('maritalStatus'))
                          _lockedField(
                            label: 'Marital status',
                            value: _maritalStatus ?? '',
                            icon: Icons.favorite_border_rounded,
                          ),
                        if (isNewId && !_canEdit('gender'))
                          _lockedField(
                            label: 'Gender',
                            value: _gender ?? '',
                            icon: Icons.wc_rounded,
                          ),
                        if (isNewId &&
                            !_canEdit('address') &&
                            !_canEdit('fullAddress'))
                          _lockedField(
                            label: 'Address',
                            value: _address.text,
                            icon: Icons.home_outlined,
                          ),
                        if (isNewId && !_canEdit('dateOfBirth'))
                          _lockedField(
                            label: 'Date of birth',
                            value: _dateOfBirth.text,
                            icon: Icons.event_outlined,
                          ),
                        if (!isNewId &&
                            !_canEdit('nationalId') &&
                            !_canEdit('nationalIdNumber'))
                          _lockedField(
                            label: 'National ID',
                            value: _nationalId.text,
                            icon: Icons.badge_outlined,
                          ),
                      ],
                    ),
                  ),
                ],
                if (needsSlot) ...[
                  const SizedBox(height: 18),
                  const SectionHeader(title: 'Appointment (optional change)'),
                  const SizedBox(height: 8),
                  SectionCard(
                    child: _CorrectionSlotPicker(
                      centerId: _centerId,
                      date: _date,
                      slot: _slot,
                      onChanged: (centerId, date, slot) {
                        setState(() {
                          _centerId = centerId;
                          _date = date;
                          _slot = slot;
                        });
                      },
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  InlineErrorBanner(message: _error!),
                ],
                const SizedBox(height: 24),
                PrimaryButton(
                  label: 'Resubmit correction',
                  loading: _submitting,
                  icon: Icons.send_rounded,
                  onPressed: _submit,
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.arrow_back_rounded),
                  label: const Text('Ku noqo'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

final _correctionAppointmentProvider =
    FutureProvider.family<Appointment, String>((ref, id) async {
  final cached = ref.watch(appointmentByIdProvider(id));
  if (cached != null) return cached;
  return ref.watch(bookingRepositoryProvider).byReference(id);
});

class _CorrectionSlotPicker extends ConsumerWidget {
  const _CorrectionSlotPicker({
    required this.centerId,
    required this.date,
    required this.slot,
    required this.onChanged,
  });

  final String? centerId;
  final DateTime? date;
  final String? slot;
  final void Function(String? centerId, DateTime? date, String? slot) onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final centers = ref.watch(centersProvider);

    return centers.when(
      loading: () => const LinearProgressIndicator(),
      error: (_, __) => const Text('Could not load centers.'),
      data: (all) {
        final active = all.where((c) => c.isActive).toList();
        final now = DateTime.now();
        final start = DateTime(now.year, now.month, now.day);
        final query = centerId == null
            ? null
            : (
                centerId: centerId!,
                start: Formatters.apiDate(start),
                end: Formatters.apiDate(
                  start.add(const Duration(days: kBookingWindowDays)),
                ),
              );
        final availability =
            query == null ? null : ref.watch(availabilityProvider(query));

        return Column(
          children: [
            DropdownButtonFormField<String>(
              initialValue:
                  active.any((c) => c.id == centerId) ? centerId : null,
              decoration: const InputDecoration(labelText: 'Center'),
              items: active
                  .map(
                    (c) =>
                        DropdownMenuItem(value: c.id, child: Text(c.name)),
                  )
                  .toList(),
              onChanged: (value) => onChanged(value, null, null),
            ),
            const SizedBox(height: 12),
            if (availability != null)
              availability.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(12),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                error: (_, __) => const Text('Could not load slots.'),
                data: (data) {
                  final dateKeys = data.days.entries
                      .where((e) => e.value.isAvailable)
                      .map((e) => e.key)
                      .toList()
                    ..sort();
                  return Column(
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue:
                            date == null ? null : Formatters.apiDate(date!),
                        decoration: const InputDecoration(labelText: 'Date'),
                        items: dateKeys
                            .map(
                              (key) => DropdownMenuItem(
                                value: key,
                                child: Text(Formatters.readableDate(key)),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value == null) return;
                          onChanged(
                            centerId,
                            Formatters.parseApiDate(value),
                            null,
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      if (date != null)
                        DropdownButtonFormField<String>(
                          initialValue:
                              data.slotsFor(date!).contains(slot) ? slot : null,
                          decoration:
                              const InputDecoration(labelText: 'Time'),
                          items: data
                              .slotsFor(date!)
                              .map(
                                (s) => DropdownMenuItem(
                                  value: s,
                                  child: Text(s),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              onChanged(centerId, date, value),
                        ),
                    ],
                  );
                },
              ),
          ],
        );
      },
    );
  }
}
