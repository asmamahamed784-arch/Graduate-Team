import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/models/availability.dart';
import '../../../shared/models/center.dart';
import '../../../shared/models/service.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/application/otp_flow.dart';
import '../../auth/data/otp_repository.dart';
import '../../centers/data/center_repository.dart';
import '../../services/data/service_repository.dart';
import '../application/availability_provider.dart';
import '../application/booking_draft.dart';

/// Banadir districts — same list as the web New ID registration form.
const _kBanadirDistricts = <String>[
  'Abdulaziz',
  'Boondheere',
  'Dayniile',
  'Dharkenley',
  'Garasbaaley',
  'Heliwaa',
  'Hodan',
  'Howlwadaag',
  'Kaaraan',
  'Kaxda',
  'Shangaani',
  'Shibis',
  'Waaberi',
  'Wadajir',
  'Wardhiigley',
  'Xamar Jajab',
  'Xamar Weyne',
  'Yaqshiid',
];

/// One form for all four request types the backend supports. The fields shown
/// and the details block that is posted depend on `ServiceModel.requestType`.
class BookingScreen extends ConsumerStatefulWidget {
  const BookingScreen({super.key, required this.serviceId});

  final String serviceId;

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  final _formKey = GlobalKey<FormState>();

  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _motherName = TextEditingController();
  final _dateOfBirth = TextEditingController();
  final _district = TextEditingController();
  final _address = TextEditingController();
  final _landmark = TextEditingController();
  final _nationalId = TextEditingController();
  final _dateLost = TextEditingController();
  final _placeLost = TextEditingController();
  final _policeReport = TextEditingController();
  final _notes = TextEditingController();
  final _fieldToUpdate = TextEditingController();
  final _currentValue = TextEditingController();
  final _newValue = TextEditingController();
  final _reason = TextEditingController();

  String? _gender;
  String? _maritalStatus;
  String _lostReason = 'Lost';
  String _mistakeType = 'Document type';

  CenterModel? _center;
  DateTime? _selectedDate;
  String? _selectedSlot;

  /// needsSlot: 0 center → 1 date&time → 2 your info → 3 confirm (OTP).
  /// Update-information: 0 details → 1 confirm.
  int _step = 0;

  bool _submitting = false;
  String? _error;
  bool _prefilled = false;

  @override
  void dispose() {
    for (final controller in [
      _fullName,
      _phone,
      _motherName,
      _dateOfBirth,
      _district,
      _address,
      _landmark,
      _nationalId,
      _dateLost,
      _placeLost,
      _policeReport,
      _notes,
      _fieldToUpdate,
      _currentValue,
      _newValue,
      _reason,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _prefillFromProfile() {
    if (_prefilled) return;
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    _prefilled = true;
    _fullName.text = user.displayName;
    _phone.text = Validators.normalizePhone(user.phone);
    _nationalId.text = user.nationalId;
    _dateOfBirth.text = user.dateOfBirth;
    _address.text = user.address;
    final marital = user.maritalStatus.trim().toUpperCase();
    if (marital == 'SINGLE' || marital == 'MARRIED') {
      _maritalStatus = marital;
    }
  }

  AvailabilityQuery? get _availabilityQuery {
    final center = _center;
    if (center == null) return null;
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day);
    return (
      centerId: center.id,
      start: Formatters.apiDate(start),
      end: Formatters.apiDate(start.add(const Duration(days: kBookingWindowDays))),
    );
  }

  int? get _ageFromDob {
    final dob = Formatters.parseApiDate(_dateOfBirth.text);
    if (dob == null) return null;
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) {
      age -= 1;
    }
    return age < 0 ? null : age;
  }

  Future<void> _pickDate(Availability availability) async {
    final now = DateTime.now();
    final firstDate = DateTime(now.year, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: _firstSelectableDate(availability, firstDate),
      firstDate: firstDate,
      lastDate: firstDate.add(const Duration(days: kBookingWindowDays)),
      selectableDayPredicate: availability.isSelectable,
      helpText: 'Choose an appointment date',
    );
    if (picked == null) return;
    setState(() {
      _selectedDate = picked;
      _selectedSlot = null;
    });
  }

  DateTime _firstSelectableDate(Availability availability, DateTime from) {
    if (_selectedDate != null && availability.isSelectable(_selectedDate!)) {
      return _selectedDate!;
    }
    for (var i = 0; i <= kBookingWindowDays; i++) {
      final candidate = from.add(Duration(days: i));
      if (availability.isSelectable(candidate)) return candidate;
    }
    return from;
  }

  Future<void> _pickTextDate(TextEditingController controller, {bool past = true}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: past ? DateTime(now.year - 20, now.month, now.day) : now,
      firstDate: past ? DateTime(1920) : now,
      lastDate: past ? now : now.add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() => controller.text = Formatters.apiDate(picked));
  }

  /// Builds the request body for `POST /api/bookings`, minus the OTP token.
  Map<String, dynamic> _buildPayload(ServiceModel service) {
    final citizenName = _fullName.text.trim();
    final phone = Validators.normalizePhone(_phone.text);

    final base = <String, dynamic>{
      'serviceId': service.id,
      'citizenName': citizenName,
    };

    if (service.requestType != RequestTypes.updateInformation) {
      base.addAll({
        'centerId': _center?.id,
        'date': _selectedDate == null ? null : Formatters.apiDate(_selectedDate!),
        'timeSlot': _selectedSlot,
      });
    }

    switch (service.requestType) {
      case RequestTypes.newNationalId:
        base['registrationDetails'] = {
          'fullName': citizenName,
          'motherName': _motherName.text.trim(),
          'dateOfBirth': _dateOfBirth.text.trim(),
          'age': _ageFromDob,
          'phone': phone,
          'gender': _gender ?? '',
          'maritalStatus': _maritalStatus ?? '',
          'district': _district.text.trim(),
          'address': _address.text.trim(),
          'fullAddress': _address.text.trim(),
          'nearestLandmark': _landmark.text.trim(),
          'selectedCenter': _center?.name ?? '',
          'centerDistrict': _center?.district ?? '',
          'appointmentDate':
              _selectedDate == null ? '' : Formatters.apiDate(_selectedDate!),
          'appointmentTime': _selectedSlot ?? '',
        };
      case RequestTypes.lostReplacement:
        base['replacementDetails'] = {
          'nationalIdNumber': _nationalId.text.trim(),
          'fullName': citizenName,
          'phone': phone,
          'district': _district.text.trim(),
          'dateLost': _dateLost.text.trim(),
          'placeLost': _placeLost.text.trim(),
          'reason': _lostReason,
          'policeReportNumber': _policeReport.text.trim(),
          'additionalNotes': _notes.text.trim(),
        };
      case RequestTypes.updateInformation:
        base['updateDetails'] = {
          'nationalIdNumber': _nationalId.text.trim(),
          'fullName': citizenName,
          'phone': phone,
          'mistakeType': _mistakeType,
          'selectedFields': [_fieldToUpdate.text.trim()],
          'changes': [
            {
              'field': _fieldToUpdate.text.trim(),
              'currentValue': _currentValue.text.trim(),
              'newValue': _newValue.text.trim(),
              'reason': _reason.text.trim(),
            }
          ],
          'notes': _notes.text.trim(),
        };
      default:
        base['serviceRequestDetails'] = {
          'fullName': citizenName,
          'phone': phone,
          'district': _district.text.trim(),
          'notes': _notes.text.trim(),
        };
    }

    return base;
  }

  Future<void> _submit(ServiceModel service) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final needsSlot = service.requestType != RequestTypes.updateInformation;
    if (needsSlot && (_center == null || _selectedDate == null || _selectedSlot == null)) {
      setState(() => _error = 'Choose a center, a date and a time slot to continue.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });

    final phone = Validators.normalizePhone(_phone.text);
    final purpose = BookingDraft.purposeFor(service.requestType);

    try {
      final session = await ref.read(otpRepositoryProvider).request(
            purpose: purpose,
            phone: phone,
          );

      ref.read(bookingDraftProvider.notifier).set(
            BookingDraft(
              serviceId: service.id,
              serviceName: service.name,
              requestType: service.requestType,
              otpPurpose: purpose,
              phone: phone,
              payload: _buildPayload(service),
              centerName: _center?.name,
              date: _selectedDate == null ? null : Formatters.apiDate(_selectedDate!),
              timeSlot: _selectedSlot,
            ),
          );

      if (!mounted) return;
      context.push(
        AppRoutes.verifyOtp,
        extra: OtpArgs(
          mode: OtpMode.booking,
          session: session,
          title: 'Confirm your request',
          subtitle: 'Enter the code we sent so we can submit ${service.name}.',
        ),
      );
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
    final serviceAsync = ref.watch(serviceByIdProvider(widget.serviceId));
    _prefillFromProfile();

    return Scaffold(
      appBar: AppBar(title: const Text('Book Appointment')),
      body: serviceAsync.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(serviceByIdProvider(widget.serviceId)),
        ),
        data: (service) => _buildForm(service),
      ),
    );
  }

  List<String> _stepLabels(bool needsSlot) => needsSlot
      ? const ['Center', 'Date & Time', 'Your Information', 'Confirm']
      : const ['Your Information', 'Confirm'];

  void _goNext(ServiceModel service, bool needsSlot) {
    setState(() => _error = null);
    if (needsSlot) {
      if (_step == 0 && _center == null) {
        setState(() => _error = 'Select a service center to continue.');
        return;
      }
      if (_step == 1) {
        if (_selectedDate == null) {
          setState(() => _error = 'Select an appointment date.');
          return;
        }
        if (_selectedSlot == null || _selectedSlot!.isEmpty) {
          setState(() => _error = 'Select a time slot.');
          return;
        }
      }
      if (_step == 2 && !(_formKey.currentState?.validate() ?? false)) return;
      if (_step < 3) {
        setState(() => _step += 1);
        return;
      }
      _submit(service);
      return;
    }

    if (_step == 0 && !(_formKey.currentState?.validate() ?? false)) return;
    if (_step == 0) {
      setState(() => _step = 1);
      return;
    }
    _submit(service);
  }

  Widget _buildForm(ServiceModel service) {
    final user = ref.watch(currentUserProvider);
    final needsSlot = service.requestType != RequestTypes.updateInformation;
    final labels = _stepLabels(needsSlot);
    final step = needsSlot ? _step.clamp(0, 3) : _step.clamp(0, 1);
    final isPersonalStep = (!needsSlot && step == 0) || (needsSlot && step == 2);
    final isConfirmStep = (!needsSlot && step == 1) || (needsSlot && step == 3);

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          SectionCard(
            child: Row(
              children: [
                const Icon(Icons.assignment_outlined, color: AppColors.navy),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        service.name,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Step ${step + 1} of ${labels.length}: ${labels[step]}',
                        style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _StepProgress(current: step, total: labels.length, labels: labels),
          if (needsSlot) ...[
            const SizedBox(height: 12),
            _SelectionStrip(
              serviceName: service.name,
              centerName: _center?.name,
              dateLabel: _selectedDate == null
                  ? null
                  : Formatters.readableDate(Formatters.apiDate(_selectedDate!)),
              timeLabel: _selectedSlot,
              districtLabel: _district.text.trim().isEmpty ? null : _district.text.trim(),
            ),
          ],
          if (user != null && !user.hasPhone) ...[
            const SizedBox(height: 14),
            const InlineErrorBanner(
              message:
                  'Add a phone number to your profile so we can send the confirmation code.',
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 14),
            InlineErrorBanner(message: _error!),
          ],
          const SizedBox(height: 18),
          if (needsSlot && step == 0) ...[
            const SectionHeader(title: 'Select service center'),
            _CenterPicker(
              selected: _center,
              onChanged: (center) => setState(() {
                _center = center;
                _selectedDate = null;
                _selectedSlot = null;
              }),
            ),
          ] else if (needsSlot && step == 1) ...[
            const SectionHeader(title: 'Select date & time'),
            _buildDateTimeSection(),
          ] else if (isPersonalStep) ...[
            const SectionHeader(title: 'Your Information'),
            SectionCard(
              child: Column(
                children: [
                  TextFormField(
                    controller: _fullName,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Full name'),
                    validator: (value) => Validators.minLength(value, 3, 'Full name'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(
                      labelText: 'Phone number',
                      prefixText: '+252 ',
                      helperText: 'The confirmation code is sent to this number.',
                    ),
                    validator: (value) => Validators.phone(value),
                  ),
                  ..._detailFields(service),
                ],
              ),
            ),
          ] else if (isConfirmStep) ...[
            const SectionHeader(title: 'Confirm'),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Service',
                    value: service.name,
                    icon: Icons.assignment_outlined,
                  ),
                  if (needsSlot) ...[
                    DetailRow(
                      label: 'Center',
                      value: _center?.name ?? '--',
                      icon: Icons.location_city_rounded,
                    ),
                    DetailRow(
                      label: 'District',
                      value: _district.text.trim().isEmpty
                          ? (_center?.district.isNotEmpty == true
                              ? _center!.district
                              : '--')
                          : _district.text.trim(),
                      icon: Icons.map_outlined,
                    ),
                    DetailRow(
                      label: 'Date',
                      value: _selectedDate == null
                          ? '--'
                          : Formatters.readableDate(Formatters.apiDate(_selectedDate!)),
                      icon: Icons.event_outlined,
                    ),
                    DetailRow(
                      label: 'Time',
                      value: _selectedSlot ?? '--',
                      icon: Icons.schedule_rounded,
                    ),
                  ],
                  DetailRow(
                    label: 'Full name',
                    value: _fullName.text,
                    icon: Icons.person_outline,
                  ),
                  DetailRow(
                    label: 'Phone',
                    value: Formatters.phoneDisplay(_phone.text),
                    icon: Icons.phone_outlined,
                  ),
                  if (service.requestType == RequestTypes.newNationalId) ...[
                    DetailRow(
                      label: "Mother's name",
                      value: _motherName.text,
                      icon: Icons.family_restroom_rounded,
                    ),
                    DetailRow(
                      label: 'Date of birth',
                      value: Formatters.readableDate(_dateOfBirth.text),
                      icon: Icons.cake_outlined,
                    ),
                    if (_ageFromDob != null)
                      DetailRow(
                        label: 'Age',
                        value: '$_ageFromDob',
                        icon: Icons.numbers_rounded,
                      ),
                    DetailRow(
                      label: 'Gender',
                      value: _gender ?? '--',
                      icon: Icons.wc_rounded,
                    ),
                    DetailRow(
                      label: 'Marital status',
                      value: Formatters.titleCase(_maritalStatus),
                      icon: Icons.favorite_border_rounded,
                    ),
                    DetailRow(
                      label: 'Address',
                      value: _address.text,
                      icon: Icons.home_outlined,
                    ),
                    if (_landmark.text.trim().isNotEmpty)
                      DetailRow(
                        label: 'Landmark',
                        value: _landmark.text,
                        icon: Icons.place_outlined,
                      ),
                  ],
                ],
              ),
            ),
            if (needsSlot) ...[
              const SizedBox(height: 12),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Booking Summary',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Review your appointment before confirming.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12.5),
                    ),
                    const SizedBox(height: 12),
                    DetailRow(label: 'Service', value: service.name),
                    DetailRow(
                      label: 'Center',
                      value: _center?.name ?? 'Not selected',
                    ),
                    DetailRow(
                      label: 'Date',
                      value: _selectedDate == null
                          ? 'Not selected'
                          : Formatters.readableDate(Formatters.apiDate(_selectedDate!)),
                    ),
                    DetailRow(
                      label: 'Time',
                      value: _selectedSlot ?? 'Not selected',
                    ),
                    const DetailRow(label: 'Status', value: 'Ready for confirmation'),
                  ],
                ),
              ),
            ],
          ],
          const SizedBox(height: 28),
          Row(
            children: [
              if (step > 0)
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting ? null : () => setState(() => _step -= 1),
                    child: const Text('Previous'),
                  ),
                ),
              if (step > 0) const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: PrimaryButton(
                  label: step >= labels.length - 1 ? 'Confirm appointment' : 'Next',
                  icon: step >= labels.length - 1
                      ? Icons.sms_outlined
                      : Icons.arrow_forward_rounded,
                  loading: _submitting,
                  onPressed: () => _goNext(service, needsSlot),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'After confirmation you will receive a QR ticket. You can cancel within one hour.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 12.5),
          ),
        ],
      ),
    );
  }

  List<Widget> _detailFields(ServiceModel service) {
    switch (service.requestType) {
      case RequestTypes.newNationalId:
        final age = _ageFromDob;
        return [
          const SizedBox(height: 14),
          TextFormField(
            controller: _motherName,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: "Mother's full name"),
            validator: (value) => Validators.minLength(value, 3, "Mother's name"),
          ),
          const SizedBox(height: 14),
          _DateField(
            controller: _dateOfBirth,
            label: 'Date of birth',
            onTap: () => _pickTextDate(_dateOfBirth),
            validator: (value) => Validators.notEmpty(value, 'Date of birth'),
          ),
          const SizedBox(height: 14),
          InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Age',
              helperText: 'Auto calculated from date of birth.',
            ),
            child: Text(
              age == null ? 'Auto calculated' : '$age',
              style: TextStyle(
                color: age == null ? AppColors.muted : null,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            key: ValueKey('gender-${_gender ?? 'none'}'),
            initialValue: _gender,
            decoration: const InputDecoration(labelText: 'Gender'),
            hint: const Text('Select gender'),
            items: const [
              DropdownMenuItem(value: 'Male', child: Text('Male')),
              DropdownMenuItem(value: 'Female', child: Text('Female')),
            ],
            validator: (value) =>
                value == null || value.isEmpty ? 'Select gender' : null,
            onChanged: (value) => setState(() => _gender = value),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            key: ValueKey('marital-${_maritalStatus ?? 'none'}'),
            initialValue: _maritalStatus,
            decoration: const InputDecoration(labelText: 'Marital status'),
            hint: const Text('Select marital status'),
            items: const [
              DropdownMenuItem(value: 'SINGLE', child: Text('Single')),
              DropdownMenuItem(value: 'MARRIED', child: Text('Married')),
            ],
            validator: (value) =>
                value == null || value.isEmpty ? 'Select marital status' : null,
            onChanged: (value) => setState(() => _maritalStatus = value),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            key: ValueKey('district-${_district.text.trim().isEmpty ? 'none' : _district.text.trim()}'),
            initialValue: _district.text.trim().isEmpty ||
                    !_kBanadirDistricts.contains(_district.text.trim())
                ? null
                : _district.text.trim(),
            decoration: const InputDecoration(labelText: 'District where you live'),
            hint: const Text('Select your district'),
            isExpanded: true,
            items: _kBanadirDistricts
                .map(
                  (district) => DropdownMenuItem(
                    value: district,
                    child: Text(district),
                  ),
                )
                .toList(),
            validator: (value) =>
                value == null || value.isEmpty ? 'Select your district' : null,
            onChanged: (value) {
              if (value == null) return;
              setState(() => _district.text = value);
            },
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _landmark,
            decoration: const InputDecoration(
              labelText: 'Nearest landmark',
              hintText: 'KM4',
            ),
            validator: (value) => Validators.notEmpty(value, 'Nearest landmark'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _address,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Full address',
              hintText: 'Hodan District, Near KM4, Mogadishu',
            ),
            validator: (value) => Validators.notEmpty(value, 'Full address'),
          ),
        ];

      case RequestTypes.lostReplacement:
        return [
          const SizedBox(height: 14),
          TextFormField(
            controller: _nationalId,
            decoration: const InputDecoration(labelText: 'National ID number'),
            validator: Validators.nationalId,
          ),
          const SizedBox(height: 14),
          _ChoiceField(
            label: 'What happened?',
            value: _lostReason,
            options: const ['Lost', 'Stolen', 'Damaged'],
            onChanged: (value) => setState(() => _lostReason = value),
          ),
          const SizedBox(height: 14),
          _DateField(
            controller: _dateLost,
            label: 'Date the card was lost',
            onTap: () => _pickTextDate(_dateLost),
            validator: (value) => Validators.notEmpty(value, 'Date lost'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _placeLost,
            decoration: const InputDecoration(labelText: 'Where it was lost'),
            validator: (value) => Validators.notEmpty(value, 'Place lost'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _district,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'District'),
            validator: (value) => Validators.notEmpty(value, 'District'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _policeReport,
            decoration: const InputDecoration(
              labelText: 'Police report number (optional)',
            ),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _notes,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Additional notes (optional)'),
          ),
        ];

      case RequestTypes.updateInformation:
        return [
          const SizedBox(height: 14),
          TextFormField(
            controller: _nationalId,
            decoration: const InputDecoration(labelText: 'National ID number'),
            validator: Validators.nationalId,
          ),
          const SizedBox(height: 14),
          _ChoiceField(
            label: 'Type of mistake',
            value: _mistakeType,
            options: const ['Document type', 'Office Mistake', 'Mixed Mistake'],
            onChanged: (value) => setState(() => _mistakeType = value),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _fieldToUpdate,
            decoration: const InputDecoration(
              labelText: 'Field to correct',
              hintText: 'e.g. Full name, Date of birth',
            ),
            validator: (value) => Validators.notEmpty(value, 'Field to correct'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _currentValue,
            decoration: const InputDecoration(labelText: 'Current value'),
            validator: (value) => Validators.notEmpty(value, 'Current value'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _newValue,
            decoration: const InputDecoration(labelText: 'Corrected value'),
            validator: (value) => Validators.notEmpty(value, 'Corrected value'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _reason,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Reason for the correction'),
            validator: (value) => Validators.minLength(value, 5, 'Reason'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Notes (optional)'),
          ),
        ];

      default:
        return [
          const SizedBox(height: 14),
          TextFormField(
            controller: _district,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'District'),
            validator: (value) => Validators.notEmpty(value, 'District'),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _notes,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Tell us about your request (optional)',
            ),
          ),
        ];
    }
  }

  Widget _buildDateTimeSection() {
    final query = _availabilityQuery;
    if (query == null) {
      return const SectionCard(
        child: Text(
          'Select a service center to see available dates and times.',
          style: TextStyle(color: AppColors.muted),
        ),
      );
    }

    final availability = ref.watch(availabilityProvider(query));

    return availability.when(
      loading: () => const SectionCard(
        child: SizedBox(
          height: 74,
          child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
        ),
      ),
      error: (error, _) => SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InlineErrorBanner(
              message: error is ApiException
                  ? error.message
                  : 'Could not load available times.',
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => ref.invalidate(availabilityProvider(query)),
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (data) {
        final slots = _selectedDate == null ? <String>[] : data.slotsFor(_selectedDate!);
        return SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              InkWell(
                onTap: () => _pickDate(data),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.lightBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.event_outlined, color: AppColors.muted),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _selectedDate == null
                              ? 'Choose an appointment date'
                              : Formatters.readableDate(
                                  Formatters.apiDate(_selectedDate!),
                                ),
                          style: TextStyle(
                            color: _selectedDate == null ? AppColors.muted : null,
                            fontWeight:
                                _selectedDate == null ? null : FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.expand_more_rounded, color: AppColors.muted),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Fully booked and closed days are disabled in the calendar.',
                style: TextStyle(color: AppColors.muted, fontSize: 12.5),
              ),
              const SizedBox(height: 18),
              const Text(
                'Available times',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
              if (_selectedDate == null)
                const Text(
                  'Choose a date to see time slots.',
                  style: TextStyle(color: AppColors.muted, fontSize: 12.5),
                )
              else if (slots.isEmpty)
                const Text(
                  'No time slots are left on this date. Please choose another day.',
                  style: TextStyle(color: AppColors.danger, fontSize: 13),
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: slots
                      .map(
                        (slot) => ChoiceChip(
                          label: Text(slot),
                          selected: _selectedSlot == slot,
                          onSelected: (_) => setState(() => _selectedSlot = slot),
                        ),
                      )
                      .toList(),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _SelectionStrip extends StatelessWidget {
  const _SelectionStrip({
    required this.serviceName,
    this.centerName,
    this.dateLabel,
    this.timeLabel,
    this.districtLabel,
  });

  final String serviceName;
  final String? centerName;
  final String? dateLabel;
  final String? timeLabel;
  final String? districtLabel;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        children: [
          _StripRow(label: 'Service', value: serviceName),
          _StripRow(label: 'Center', value: centerName ?? 'Not selected'),
          if (districtLabel != null && districtLabel!.isNotEmpty)
            _StripRow(label: 'District', value: districtLabel!),
          _StripRow(label: 'Date', value: dateLabel ?? 'Not selected'),
          _StripRow(label: 'Time', value: timeLabel ?? 'Not selected'),
        ],
      ),
    );
  }
}

class _StripRow extends StatelessWidget {
  const _StripRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _CenterPicker extends ConsumerWidget {
  const _CenterPicker({required this.selected, required this.onChanged});

  final CenterModel? selected;
  final ValueChanged<CenterModel> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final centers = ref.watch(centersProvider);

    return centers.when(
      loading: () => const SectionCard(
        child: SizedBox(
          height: 48,
          child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
        ),
      ),
      error: (error, _) => SectionCard(
        child: InlineErrorBanner(
          message: error is ApiException ? error.message : 'Could not load centers.',
        ),
      ),
      data: (all) {
        final active = all.where((center) => center.isActive).toList();
        if (active.isEmpty) {
          return const SectionCard(
            child: Text(
              'No service centers are open for booking right now.',
              style: TextStyle(color: AppColors.muted),
            ),
          );
        }
        return SectionCard(
          child: DropdownButtonFormField<String>(
            initialValue: selected?.id,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Service center'),
            items: active
                .map(
                  (center) => DropdownMenuItem(
                    value: center.id,
                    child: Text(
                      '${center.name} — ${center.district}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            validator: (value) =>
                value == null ? 'Choose the center you want to visit.' : null,
            onChanged: (value) {
              if (value == null) return;
              onChanged(active.firstWhere((center) => center.id == value));
            },
          ),
        );
      },
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.controller,
    required this.label,
    required this.onTap,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final VoidCallback onTap;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      readOnly: true,
      onTap: onTap,
      decoration: InputDecoration(
        labelText: label,
        hintText: 'yyyy-mm-dd',
        suffixIcon: const Icon(Icons.calendar_today_rounded, size: 18),
      ),
      validator: validator,
    );
  }
}

class _ChoiceField extends StatelessWidget {
  const _ChoiceField({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: options
              .map(
                (option) => ChoiceChip(
                  label: Text(option),
                  selected: value == option,
                  onSelected: (_) => onChanged(option),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _StepProgress extends StatelessWidget {
  const _StepProgress({
    required this.current,
    required this.total,
    required this.labels,
  });

  final int current;
  final int total;
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: List.generate(total, (i) {
            final active = i <= current;
            return Expanded(
              child: Container(
                margin: EdgeInsets.only(right: i == total - 1 ? 0 : 4),
                height: 4,
                decoration: BoxDecoration(
                  color: active ? AppColors.primary : AppColors.lightBorder,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: Text(
            labels[current.clamp(0, labels.length - 1)],
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }
}
