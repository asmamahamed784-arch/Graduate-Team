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
import '../application/appointments_controller.dart';
import '../application/availability_provider.dart';
import '../application/booking_draft.dart';
import 'widgets/booking_mock_fields.dart';

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

  // Mockup brand blue (not brown). Name kept short for local use.
  static const Color _brand = BookingMockStyle.accent;
  static const Color _ink = BookingMockStyle.ink;
  static const Color _placeholder = BookingMockStyle.placeholder;

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

  /// Update Information — multi-select fields (same pattern as web).
  final List<String> _selectedUpdateFields = [];
  final Map<String, TextEditingController> _updateNewValues = {};
  final Map<String, TextEditingController> _updateReasons = {};

  static const _updateFieldOptions = [
    'Name',
    "Mother's Name",
    'Age',
    'Date of Birth',
    'Phone Number',
    'Address',
    'District',
    'Marital Status',
    'Other',
  ];

  String? _gender;
  String? _maritalStatus;
  String _lostReason = 'Lost';
  String _mistakeType = 'Document type';
  String? _otherFieldLabel;

  CenterModel? _center;
  DateTime? _selectedDate;
  String? _selectedSlot;

  bool _submitting = false;
  String? _error;
  bool _prefilled = false;
  int _currentStep = 0;
  bool _infoConfirmed = false;
  String? _policeReportFileName;

  @override
  void initState() {
    super.initState();
    // Warms the centers/districts cache from Step 1 so the District dropdown
    // on Step 2 almost never renders before its options have arrived — the
    // step 2 field still shows a proper loading state if the network is slow
    // enough that this hasn't resolved yet.
    ref.read(centersProvider);
  }

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
    ]) {
      controller.dispose();
    }
    for (final c in _updateNewValues.values) {
      c.dispose();
    }
    for (final c in _updateReasons.values) {
      c.dispose();
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

  String _currentValueForUpdateField(String field) {
    final reg = ref.read(completedNewRegistrationProvider);
    final details = reg?.details ?? const <String, dynamic>{};
    final user = ref.read(currentUserProvider);
    final key = field.toLowerCase();

    if (key == 'name' || key.contains('full name')) {
      return '${details['fullName'] ?? reg?.citizenName ?? user?.displayName ?? ''}'
          .trim();
    }
    if (key.contains('mother')) {
      return '${details['motherName'] ?? ''}'.trim();
    }
    if (key == 'age') {
      return '${details['age'] ?? ''}'.trim();
    }
    if (key.contains('birth')) {
      return '${details['dateOfBirth'] ?? user?.dateOfBirth ?? ''}'.trim();
    }
    if (key.contains('phone')) {
      final phone = '${details['phone'] ?? user?.phone ?? ''}'.trim();
      return phone.isEmpty ? '' : Validators.normalizePhone(phone);
    }
    if (key.contains('address')) {
      return '${details['fullAddress'] ?? details['address'] ?? user?.address ?? ''}'
          .trim();
    }
    if (key.contains('district')) {
      return '${details['district'] ?? details['centerDistrict'] ?? reg?.district ?? ''}'
          .trim();
    }
    if (key.contains('marital')) {
      final raw = '${details['maritalStatus'] ?? user?.maritalStatus ?? ''}'
          .trim()
          .toUpperCase();
      if (raw == 'SINGLE') return 'Single';
      if (raw == 'MARRIED') return 'Married';
      return raw;
    }
    return '';
  }

  void _toggleUpdateField(String field) {
    setState(() {
      if (_selectedUpdateFields.contains(field)) {
        _selectedUpdateFields.remove(field);
        _updateNewValues.remove(field)?.dispose();
        _updateReasons.remove(field)?.dispose();
        if (field == 'Other') _otherFieldLabel = null;
      } else {
        _selectedUpdateFields.add(field);
        _updateNewValues[field] = TextEditingController();
        _updateReasons[field] = TextEditingController();
      }
    });
  }

  List<Map<String, String>> _buildUpdateChanges() {
    return _selectedUpdateFields.map((field) {
      final label = field == 'Other'
          ? (_otherFieldLabel?.trim().isNotEmpty == true
                ? _otherFieldLabel!.trim()
                : 'Other')
          : field;
      return {
        'field': label,
        'currentValue': _currentValueForUpdateField(field).isEmpty
            ? 'Not recorded in current record'
            : _currentValueForUpdateField(field),
        'newValue': _updateNewValues[field]?.text.trim() ?? '',
        'reason': _updateReasons[field]?.text.trim() ?? '',
      };
    }).toList();
  }

  AvailabilityQuery? get _availabilityQuery {
    final center = _center;
    if (center == null) return null;
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day);
    return (
      centerId: center.id,
      start: Formatters.apiDate(start),
      end: Formatters.apiDate(
        start.add(const Duration(days: kBookingWindowDays)),
      ),
    );
  }

  int? get _ageFromDob {
    final dob = Formatters.parseApiDate(_dateOfBirth.text);
    if (dob == null) return null;
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      age -= 1;
    }
    return age < 0 ? null : age;
  }

  /// Appointment day must be open on the API calendar AND on the center
  /// schedule (working days + closed holiday dates from Admin).
  bool _isAppointmentDateOpen(Availability availability, DateTime date) {
    final day = DateTime(date.year, date.month, date.day);
    final center = _center;
    if (center != null && !center.schedule.isOpenOn(day)) return false;
    return availability.isSelectable(day);
  }

  Future<void> _pickDate(Availability availability) async {
    final now = DateTime.now();
    final firstDate = DateTime(now.year, now.month, now.day);
    final lastDate = firstDate.add(const Duration(days: kBookingWindowDays));
    final initial = _firstSelectableDate(availability, firstDate);
    if (initial == null) {
      setState(
        () => _error =
            'This center has no open appointment dates in the next $kBookingWindowDays days (closed days / holidays).',
      );
      return;
    }
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: firstDate,
      lastDate: lastDate,
      selectableDayPredicate: (date) =>
          _isAppointmentDateOpen(availability, date),
      helpText: 'Choose an appointment date',
    );
    if (picked == null) return;
    setState(() {
      _error = null;
      _selectedDate = picked;
      _selectedSlot = null;
    });
  }

  DateTime? _firstSelectableDate(Availability availability, DateTime from) {
    if (_selectedDate != null &&
        _isAppointmentDateOpen(availability, _selectedDate!)) {
      return _selectedDate!;
    }
    for (var i = 0; i <= kBookingWindowDays; i++) {
      final candidate = from.add(Duration(days: i));
      if (_isAppointmentDateOpen(availability, candidate)) return candidate;
    }
    return null;
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final current = Formatters.parseApiDate(_dateOfBirth.text);
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime(now.year - 20, now.month, now.day),
      firstDate: DateTime(1920),
      lastDate: now,
      helpText: 'DATE OF BIRTH',
      fieldHintText: 'mm/dd/yyyy',
      fieldLabelText: 'Date of Birth',
    );
    if (picked == null) return;
    setState(() => _dateOfBirth.text = Formatters.apiDate(picked));
  }

  Future<void> _pickTextDate(
    TextEditingController controller, {
    bool past = true,
  }) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: past ? DateTime(now.year - 20, now.month, now.day) : now,
      firstDate: past ? DateTime(1920) : now,
      lastDate: past ? now : now.add(const Duration(days: 365)),
      fieldHintText: 'mm/dd/yyyy',
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
      'centerId': _center?.id,
      'date': _selectedDate == null ? null : Formatters.apiDate(_selectedDate!),
      'timeSlot': _selectedSlot,
    };

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
          'appointmentDate': _selectedDate == null
              ? ''
              : Formatters.apiDate(_selectedDate!),
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
          'policeReportFileName': _policeReportFileName ?? '',
          'additionalNotes': _notes.text.trim(),
        };
      case RequestTypes.updateInformation:
        final changes = _buildUpdateChanges();
        base['updateDetails'] = {
          'nationalIdNumber': _nationalId.text.trim(),
          'fullName': citizenName,
          'phone': phone,
          'mistakeType': _mistakeType,
          'selectedFields': changes.map((c) => c['field'] ?? '').toList(),
          'changes': changes,
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

    if (_center == null || _selectedDate == null || _selectedSlot == null) {
      setState(
        () => _error = 'Choose a center, a date and a time slot to continue.',
      );
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
      final session = await ref
          .read(otpRepositoryProvider)
          .request(purpose: purpose, phone: phone);

      ref
          .read(bookingDraftProvider.notifier)
          .set(
            BookingDraft(
              serviceId: service.id,
              serviceName: service.name,
              requestType: service.requestType,
              otpPurpose: purpose,
              phone: phone,
              payload: _buildPayload(service),
              centerName: _center?.name,
              date: _selectedDate == null
                  ? null
                  : Formatters.apiDate(_selectedDate!),
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

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: serviceAsync.when(
          loading: () => const LoadingView(),
          error: (error, _) => ErrorStateView(
            error: error,
            onRetry: () =>
                ref.invalidate(serviceByIdProvider(widget.serviceId)),
          ),
          data: (service) {
            // If New Registration is already open, show that request's data
            // instead of starting another booking.
            if (service.requestType == RequestTypes.newNationalId) {
              final open = ref.watch(activeNewRegistrationProvider);
              if (open != null) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!context.mounted) return;
                  context.pushReplacement(AppRoutes.appointmentDetail(open.id));
                });
                return const LoadingView(message: 'Opening your request');
              }
            }
            return _buildForm(service);
          },
        ),
      ),
    );
  }

  void _confirmAndSubmit(ServiceModel service, bool needsSlot) {
    setState(() => _error = null);
    if (!_validateAll(service, needsSlot)) return;
    _submit(service);
  }

  bool _validateVisibleStep(ServiceModel service) {
    setState(() => _error = null);
    return _formKey.currentState?.validate() ?? false;
  }

  bool _validateAppointmentSelection() {
    String? error;
    if (_center == null) {
      error = 'Select a service center.';
    } else if (_selectedDate == null) {
      error = 'Select an appointment date.';
    } else if (_selectedSlot == null || _selectedSlot!.isEmpty) {
      error = 'Select a time slot.';
    }

    if (error != null) {
      setState(() => _error = error);
      return false;
    }
    return true;
  }

  bool _validateAll(ServiceModel service, bool needsSlot) {
    final phoneError = Validators.phone(_phone.text);
    String? error;

    if (Validators.minLength(_fullName.text, 3, 'Full name') != null) {
      error = 'Full name is required.';
    } else if (phoneError != null) {
      error = phoneError;
    }

    switch (service.requestType) {
      case RequestTypes.newNationalId:
        error ??= Validators.minLength(_motherName.text, 3, "Mother's name");
        error ??= Validators.notEmpty(_dateOfBirth.text, 'Date of birth');
        error ??= _gender == null ? 'Select gender.' : null;
        error ??= _maritalStatus == null ? 'Select marital status.' : null;
        error ??= Validators.notEmpty(_district.text, 'District');
        error ??= Validators.notEmpty(_address.text, 'Full address');
      case RequestTypes.lostReplacement:
        if (_nationalId.text.trim().isNotEmpty) {
          error ??= Validators.nationalId(_nationalId.text);
        }
        error ??= Validators.notEmpty(_dateLost.text, 'Date lost');
        error ??= Validators.notEmpty(_placeLost.text, 'Place lost');
        error ??= Validators.notEmpty(_district.text, 'District');
      case RequestTypes.updateInformation:
        error ??= Validators.nationalId(_nationalId.text);
        if (_selectedUpdateFields.isEmpty) {
          error ??= 'Select at least one field to update.';
        } else {
          for (final field in _selectedUpdateFields) {
            final newValue = _updateNewValues[field]?.text.trim() ?? '';
            final reason = _updateReasons[field]?.text.trim() ?? '';
            final current = _currentValueForUpdateField(field);
            if (field == 'Other' &&
                (_otherFieldLabel == null ||
                    _otherFieldLabel!.trim().isEmpty)) {
              error ??= 'Enter the Other field name.';
              break;
            }
            if (newValue.isEmpty) {
              error ??= 'Enter the corrected value for $field.';
              break;
            }
            if (reason.length < 5) {
              error ??= 'Enter a reason (min 5 characters) for $field.';
              break;
            }
            if (current.isNotEmpty &&
                current.toLowerCase().replaceAll(RegExp(r'\s+'), ' ') ==
                    newValue.toLowerCase().replaceAll(RegExp(r'\s+'), ' ')) {
              error ??=
                  'Xogtii hore weeye for $field. Enter a different corrected value.';
              break;
            }
          }
        }
      default:
        error ??= Validators.notEmpty(_district.text, 'District');
    }

    if (error == null && needsSlot) {
      if (_center == null) {
        error = 'Select a service center.';
      } else if (_selectedDate == null) {
        error = 'Select an appointment date.';
      } else if (_selectedSlot == null || _selectedSlot!.isEmpty) {
        error = 'Select a time slot.';
      }
    }

    if (error != null) {
      setState(() => _error = error);
      return false;
    }
    return true;
  }

  void _continue(ServiceModel service) {
    final steps = _stepsFor(service);
    final activeStep = _currentStep >= steps.length
        ? steps.length - 1
        : _currentStep;
    final step = steps[activeStep];
    if (step.kind != _BookingStepKind.review &&
        !_validateVisibleStep(service)) {
      return;
    }
    if (step.kind == _BookingStepKind.appointment &&
        !_validateAppointmentSelection()) {
      return;
    }
    if (activeStep >= steps.length - 1) {
      if (!_infoConfirmed) {
        setState(
          () => _error = 'Confirm that the information is correct to continue.',
        );
        return;
      }
      _confirmAndSubmit(service, true);
      return;
    }
    setState(() {
      _error = null;
      _currentStep = activeStep + 1;
      if (steps[_currentStep].kind == _BookingStepKind.review) {
        _infoConfirmed = false;
      }
    });
  }

  void _backStep() {
    if (_currentStep == 0) {
      context.pop();
      return;
    }
    setState(() {
      _error = null;
      _currentStep -= 1;
    });
  }

  Widget _buildForm(ServiceModel service) {
    final completedRegistration = ref.watch(completedNewRegistrationProvider);
    final requiresCompletedRegistration =
        service.requestType == RequestTypes.updateInformation ||
        service.requestType == RequestTypes.lostReplacement;
    if (requiresCompletedRegistration && completedRegistration == null) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.lock_outline_rounded,
                  color: AppColors.warning,
                  size: 34,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Complete New Registration first',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  '${service.name} opens only after Admin/Operator marks your New Registration as Completed.',
                  style: const TextStyle(color: AppColors.muted, height: 1.45),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => context.go(AppRoutes.services),
                  icon: const Icon(Icons.arrow_back_rounded),
                  label: const Text('Back to services'),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final steps = _stepsFor(service);
    final activeStep = _currentStep >= steps.length
        ? steps.length - 1
        : _currentStep;
    final step = steps[activeStep];
    final topPad = MediaQuery.paddingOf(context).top;
    final isLast = activeStep == steps.length - 1;
    final isReview = step.kind == _BookingStepKind.review;
    final isAppointment = step.kind == _BookingStepKind.appointment;
    final isLost = service.requestType == RequestTypes.lostReplacement;
    final heading = isReview ? step.title : _serviceHeading(service);
    final stepLine = isReview
        ? step.subtitle
        : 'Step ${activeStep + 1}: ${step.stepLabel}';
    final useBoxed = isAppointment || isLost;

    return Form(
      key: _formKey,
      child: Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme.copyWith(primary: _brand),
          checkboxTheme: CheckboxThemeData(
            fillColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) return _brand;
              return Colors.transparent;
            }),
            checkColor: const WidgetStatePropertyAll(Colors.white),
            side: const BorderSide(color: _brand, width: 1.6),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          inputDecorationTheme: useBoxed
              ? _boxedInputTheme
              : _underlineInputTheme,
        ),
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(4, topPad + 2, 4, 0),
              child: Column(
                children: [
                  SizedBox(
                    height: 48,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: IconButton(
                            onPressed: _submitting ? null : _backStep,
                            icon: const Icon(
                              Icons.arrow_back_ios_new_rounded,
                              size: 20,
                              color: BookingMockStyle.accent,
                            ),
                          ),
                        ),
                        const Text(
                          'NQS National ID',
                          style: TextStyle(
                            color: BookingMockStyle.accent,
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                            letterSpacing: 0.2,
                          ),
                        ),
                        if (isLost)
                          Align(
                            alignment: Alignment.centerRight,
                            child: Padding(
                              padding: const EdgeInsets.only(right: 12),
                              child: Container(
                                width: 36,
                                height: 36,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: AppColors.primarySoft,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: AppColors.primary.withValues(
                                      alpha: 0.25,
                                    ),
                                  ),
                                ),
                                child: const Text(
                                  'NQS',
                                  style: TextStyle(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(
                      isLost ? 12 : 28,
                      8,
                      isLost ? 12 : 28,
                      6,
                    ),
                    child: BookingCircleStepper(
                      current: activeStep,
                      total: steps.length,
                      labels: isLost
                          ? const [
                              'Verify Identity',
                              'Details',
                              'Review',
                              'Submit',
                            ]
                          : null,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 22, 24, 28),
                children: [
                  Text(
                    heading,
                    style: TextStyle(
                      color: isLost ? AppColors.navy : BookingMockStyle.ink,
                      fontWeight: FontWeight.w900,
                      fontSize: isLost ? 26 : 30,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    stepLine,
                    style: TextStyle(
                      color: isLost ? AppColors.muted : BookingMockStyle.accent,
                      fontSize: isLost ? 14.5 : 15.5,
                      height: 1.35,
                      fontWeight: isLost ? FontWeight.w600 : FontWeight.w700,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    InlineErrorBanner(message: _error!),
                  ],
                  const SizedBox(height: 26),
                  ..._stepContent(service, step),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                child: Column(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton(
                        onPressed: _submitting
                            ? null
                            : () => _continue(service),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: AppColors.primary.withValues(
                            alpha: 0.55,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                              isLost ? 16 : 28,
                            ),
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        child: _submitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.4,
                                  color: Colors.white,
                                ),
                              )
                            : Text(isLast ? 'Confirm & Continue' : 'Continue'),
                      ),
                    ),
                    if (isLost && isLast) ...[
                      const SizedBox(height: 10),
                      TextButton(
                        onPressed: _submitting
                            ? null
                            : () => setState(() {
                                _currentStep = 0;
                                _infoConfirmed = false;
                                _error = null;
                              }),
                        child: const Text(
                          'Edit details',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _serviceHeading(ServiceModel service) {
    switch (service.requestType) {
      case RequestTypes.newNationalId:
        return 'New National ID';
      case RequestTypes.lostReplacement:
        return 'Lost ID Replacement';
      case RequestTypes.updateInformation:
        return 'Update Information';
      default:
        return service.name;
    }
  }

  InputDecorationTheme get _underlineInputTheme {
    const border = UnderlineInputBorder(
      borderSide: BorderSide(color: _brand, width: 1.35),
    );
    return const InputDecorationTheme(
      filled: false,
      isDense: false,
      contentPadding: EdgeInsets.fromLTRB(0, 8, 0, 12),
      floatingLabelBehavior: FloatingLabelBehavior.always,
      labelStyle: TextStyle(
        color: _ink,
        fontWeight: FontWeight.w700,
        fontSize: 14,
      ),
      floatingLabelStyle: TextStyle(
        color: _ink,
        fontWeight: FontWeight.w700,
        fontSize: 14,
      ),
      hintStyle: TextStyle(
        color: _placeholder,
        fontWeight: FontWeight.w500,
        fontSize: 15,
      ),
      prefixIconColor: _brand,
      suffixIconColor: _brand,
      border: border,
      enabledBorder: border,
      focusedBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: _brand, width: 1.8),
      ),
      errorBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: AppColors.danger),
      ),
      focusedErrorBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: AppColors.danger, width: 1.6),
      ),
    );
  }

  InputDecorationTheme get _boxedInputTheme {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFFE5E7EB), width: 1.2),
    );
    return InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      isDense: false,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      floatingLabelBehavior: FloatingLabelBehavior.always,
      labelStyle: const TextStyle(
        color: _ink,
        fontWeight: FontWeight.w700,
        fontSize: 13,
      ),
      hintStyle: const TextStyle(
        color: _placeholder,
        fontWeight: FontWeight.w500,
        fontSize: 15,
      ),
      suffixIconColor: _brand,
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _brand, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
    );
  }

  List<_BookingStep> _stepsFor(ServiceModel service) {
    switch (service.requestType) {
      case RequestTypes.newNationalId:
        return const [
          _BookingStep(
            title: 'New National ID',
            stepLabel: 'Personal information',
            subtitle: 'Enter your personal details.',
            icon: Icons.person_outline_rounded,
            kind: _BookingStepKind.newIdIdentity,
          ),
          _BookingStep(
            title: 'New National ID',
            stepLabel: 'Contact details',
            subtitle: 'Phone, gender, district and address.',
            icon: Icons.badge_outlined,
            kind: _BookingStepKind.newIdProfile,
          ),
          _BookingStep(
            title: 'New National ID',
            stepLabel: 'Appointment details',
            subtitle: 'Select center, date and time to continue.',
            icon: Icons.event_available_rounded,
            kind: _BookingStepKind.appointment,
          ),
          _BookingStep(
            title: 'Review & Confirm',
            stepLabel: 'Review',
            subtitle: 'Review all information before OTP verification.',
            icon: Icons.fact_check_outlined,
            kind: _BookingStepKind.review,
          ),
        ];
      case RequestTypes.lostReplacement:
        return const [
          _BookingStep(
            title: 'Lost ID Replacement',
            stepLabel: 'Verify your identity',
            subtitle: 'Enter the details linked to your lost National ID.',
            icon: Icons.person_outline_rounded,
            kind: _BookingStepKind.lostHolder,
          ),
          _BookingStep(
            title: 'Lost ID Replacement',
            stepLabel: 'Loss details',
            subtitle: 'Tell us when and where the ID was lost.',
            icon: Icons.credit_card_off_outlined,
            kind: _BookingStepKind.lostDetails,
          ),
          _BookingStep(
            title: 'Lost ID Replacement',
            stepLabel: 'Appointment details',
            subtitle: 'Select district, center, date and time to continue.',
            icon: Icons.event_available_rounded,
            kind: _BookingStepKind.appointment,
          ),
          _BookingStep(
            title: 'Review & Confirm',
            stepLabel: 'Submit',
            subtitle: 'Review all information before OTP verification.',
            icon: Icons.fact_check_outlined,
            kind: _BookingStepKind.review,
          ),
        ];
      case RequestTypes.updateInformation:
        return const [
          _BookingStep(
            title: 'Update Information',
            stepLabel: 'Verify identity',
            subtitle: 'Confirm your name, phone and National ID number.',
            icon: Icons.person_outline_rounded,
            kind: _BookingStepKind.updateCitizen,
          ),
          _BookingStep(
            title: 'Update Information',
            stepLabel: 'Select information to update',
            subtitle: 'Tell us what information must be corrected.',
            icon: Icons.edit_note_rounded,
            kind: _BookingStepKind.updateDetails,
          ),
          _BookingStep(
            title: 'Update Information',
            stepLabel: 'Appointment details',
            subtitle: 'Select center, date and time to continue.',
            icon: Icons.event_available_rounded,
            kind: _BookingStepKind.appointment,
          ),
          _BookingStep(
            title: 'Review & Confirm',
            stepLabel: 'Review',
            subtitle: 'Review all information before OTP verification.',
            icon: Icons.fact_check_outlined,
            kind: _BookingStepKind.review,
          ),
        ];
      default:
        return const [
          _BookingStep(
            title: 'Request',
            stepLabel: 'Request information',
            subtitle: 'Basic citizen details for this service.',
            icon: Icons.person_outline_rounded,
            kind: _BookingStepKind.defaultDetails,
          ),
          _BookingStep(
            title: 'Request',
            stepLabel: 'Appointment details',
            subtitle: 'Select center, date and time to continue.',
            icon: Icons.event_available_rounded,
            kind: _BookingStepKind.appointment,
          ),
          _BookingStep(
            title: 'Review & Confirm',
            stepLabel: 'Review',
            subtitle: 'Review all information before OTP verification.',
            icon: Icons.fact_check_outlined,
            kind: _BookingStepKind.review,
          ),
        ];
    }
  }

  List<Widget> _stepContent(ServiceModel service, _BookingStep step) {
    switch (step.kind) {
      case _BookingStepKind.newIdIdentity:
        return _newIdIdentityFields();
      case _BookingStepKind.newIdProfile:
        return _newIdProfileFields();
      case _BookingStepKind.lostHolder:
        return _lostHolderFields();
      case _BookingStepKind.lostDetails:
        return _lostDetailsFields();
      case _BookingStepKind.updateCitizen:
        return _updateCitizenFields();
      case _BookingStepKind.updateDetails:
        return _updateDetailsFields();
      case _BookingStepKind.defaultDetails:
        return _defaultDetailsFields();
      case _BookingStepKind.appointment:
        if (service.requestType == RequestTypes.lostReplacement) {
          return _lostAppointmentFields();
        }
        return [
          _CenterPicker(
            selected: _center,
            onChanged: (center) => setState(() {
              _center = center;
              _selectedDate = null;
              _selectedSlot = null;
            }),
          ),
          const SizedBox(height: 18),
          _buildDateTimeSection(),
          const SizedBox(height: 18),
          const Row(
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: 18,
                color: BookingMockStyle.accent,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Center, date, and time are required to continue.',
                  style: TextStyle(
                    color: BookingMockStyle.accent,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ];
      case _BookingStepKind.review:
        return [_reviewCard(service)];
    }
  }

  List<Widget> _newIdIdentityFields() {
    final age = _ageFromDob;
    return [
      BookingTextField(
        label: 'Full Name',
        controller: _fullName,
        hint: 'Enter your full name',
        textCapitalization: TextCapitalization.words,
        validator: (value) => Validators.minLength(value, 3, 'Full name'),
      ),
      const SizedBox(height: 22),
      BookingTextField(
        label: 'Mother Name',
        controller: _motherName,
        hint: "Enter your mother's name",
        textCapitalization: TextCapitalization.words,
        validator: (value) => Validators.minLength(value, 3, "Mother's name"),
      ),
      const SizedBox(height: 22),
      _BirthDateField(
        controller: _dateOfBirth,
        onTap: _pickBirthDate,
        validator: (value) => Validators.notEmpty(value, 'Date of birth'),
      ),
      const SizedBox(height: 22),
      BookingLabeledField(
        label: 'Age',
        child: InputDecorator(
          decoration: BookingMockStyle.underline(hint: 'Enter your age'),
          child: Text(
            age == null ? 'Enter your age' : '$age years',
            style: TextStyle(
              color: age == null ? _placeholder : _ink,
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
        ),
      ),
    ];
  }

  List<Widget> _newIdProfileFields() {
    final districtOptions = ref.watch(centerDistrictsProvider);
    // Centers (and therefore districts) load from the network the first time
    // this step is reached — on a slow connection the field can render before
    // that finishes, leaving `items` empty. An empty-items dropdown silently
    // stops responding to taps, which looks like a broken field, so this
    // surfaces the real "still loading" state instead.
    final centersLoading = ref.watch(centersProvider).isLoading;
    final selectedDistrict = _district.text.trim();
    final districtValue = districtOptions.contains(selectedDistrict)
        ? selectedDistrict
        : null;

    return [
      BookingTextField(
        label: 'Phone',
        controller: _phone,
        hint: 'Enter your phone number',
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(9),
        ],
        prefix: const _PhonePrefix(),
        suffix: const Icon(
          Icons.phone_outlined,
          size: 20,
          color: BookingMockStyle.accent,
        ),
        validator: (value) => Validators.phone(value),
      ),
      const SizedBox(height: 22),
      BookingDropdownField<String>(
        label: 'Gender',
        value: _gender,
        hint: 'Select your gender',
        items: const [
          DropdownMenuItem(value: 'Male', child: Text('Male')),
          DropdownMenuItem(value: 'Female', child: Text('Female')),
        ],
        validator: (value) =>
            value == null || value.isEmpty ? 'Select gender' : null,
        onChanged: (value) => setState(() => _gender = value),
      ),
      const SizedBox(height: 22),
      BookingDropdownField<String>(
        label: 'Marital Status',
        value: _maritalStatus,
        hint: 'Select your marital status',
        items: const [
          DropdownMenuItem(value: 'SINGLE', child: Text('Single')),
          DropdownMenuItem(value: 'MARRIED', child: Text('Married')),
        ],
        validator: (value) =>
            value == null || value.isEmpty ? 'Select marital status' : null,
        onChanged: (value) => setState(() => _maritalStatus = value),
      ),
      const SizedBox(height: 22),
      BookingDropdownField<String>(
        label: 'District',
        value: districtValue,
        hint: centersLoading
            ? 'Loading districts...'
            : districtOptions.isEmpty
            ? 'No districts available'
            : 'Select your district',
        items: districtOptions
            .map(
              (district) =>
                  DropdownMenuItem(value: district, child: Text(district)),
            )
            .toList(),
        validator: (value) =>
            value == null || value.isEmpty ? 'Select your district' : null,
        onChanged: (value) {
          if (value == null) return;
          setState(() => _district.text = value);
        },
        suffix: centersLoading
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : null,
      ),
      const SizedBox(height: 22),
      BookingTextField(
        label: 'Landmark',
        controller: _landmark,
        hint: 'Enter nearest landmark',
      ),
      const SizedBox(height: 22),
      BookingTextField(
        label: 'Address',
        controller: _address,
        hint: 'Enter your full address',
        maxLines: 2,
        validator: (value) => Validators.notEmpty(value, 'Full address'),
      ),
    ];
  }

  List<Widget> _lostHolderFields() {
    return [
      BookingIconTextField(
        label: 'National ID Number',
        optional: true,
        controller: _nationalId,
        icon: Icons.badge_outlined,
        hint: 'Enter your National ID number',
        validator: (value) {
          if ((value ?? '').trim().isEmpty) return null;
          return Validators.nationalId(value);
        },
      ),
      const SizedBox(height: 18),
      BookingIconTextField(
        label: 'Full Name',
        controller: _fullName,
        icon: Icons.person_outline_rounded,
        hint: 'Enter your full name',
        textCapitalization: TextCapitalization.words,
        validator: (value) => Validators.minLength(value, 3, 'Full name'),
      ),
      const SizedBox(height: 18),
      BookingIconTextField(
        label: 'Phone Number',
        controller: _phone,
        icon: Icons.phone_outlined,
        hint: 'Enter your phone number',
        keyboardType: TextInputType.phone,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        validator: Validators.phone,
      ),
      const SizedBox(height: 18),
      const BookingInfoBanner(
        message: 'Enter the details linked to your lost National ID.',
      ),
    ];
  }

  List<Widget> _lostDetailsFields() {
    final notesLen = _notes.text.length;
    return [
      BookingIconTextField(
        label: 'Date Lost',
        controller: _dateLost,
        icon: Icons.calendar_month_rounded,
        hint: 'Select date',
        readOnly: true,
        onTap: () => _pickTextDate(_dateLost),
        validator: (value) => Validators.notEmpty(value, 'Date lost'),
        suffix: const Icon(
          Icons.keyboard_arrow_down_rounded,
          color: BookingMockStyle.accent,
        ),
      ),
      const SizedBox(height: 18),
      BookingIconTextField(
        label: 'Place Lost',
        controller: _placeLost,
        icon: Icons.location_on_outlined,
        hint: 'Enter place lost',
        validator: (value) => Validators.notEmpty(value, 'Place lost'),
      ),
      const SizedBox(height: 18),
      BookingLabeledField(
        label: 'Reason',
        child: DropdownButtonFormField<String>(
          key: ValueKey('lost-reason-$_lostReason'),
          initialValue: _lostReason,
          isExpanded: true,
          icon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: BookingMockStyle.accent,
          ),
          style: const TextStyle(
            color: BookingMockStyle.ink,
            fontWeight: FontWeight.w600,
            fontSize: 15,
          ),
          decoration: BookingMockStyle.boxed(
            hint: 'Select reason',
            prefix: const Icon(
              Icons.description_outlined,
              color: BookingMockStyle.accent,
              size: 22,
            ),
          ),
          items: const [
            DropdownMenuItem(value: 'Lost', child: Text('Lost')),
            DropdownMenuItem(value: 'Stolen', child: Text('Stolen')),
            DropdownMenuItem(value: 'Damaged', child: Text('Damaged')),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() => _lostReason = value);
          },
        ),
      ),
      const SizedBox(height: 18),
      BookingIconTextField(
        label: 'Police Report Number',
        optional: true,
        controller: _policeReport,
        icon: Icons.shield_outlined,
        hint: 'Enter police report number',
      ),
      const SizedBox(height: 18),
      BookingUploadZone(
        fileName: _policeReportFileName,
        onTap: () {
          setState(() {
            if (_policeReportFileName == null) {
              _policeReportFileName = 'police-report.pdf';
            } else {
              _policeReportFileName = null;
            }
          });
        },
      ),
      const SizedBox(height: 18),
      BookingLabeledField(
        label: 'Notes',
        child: TextFormField(
          controller: _notes,
          maxLines: 4,
          maxLength: 500,
          onChanged: (_) => setState(() {}),
          style: const TextStyle(
            color: BookingMockStyle.ink,
            fontWeight: FontWeight.w600,
            fontSize: 15,
          ),
          decoration:
              BookingMockStyle.boxed(
                hint: 'Enter any additional details (optional)',
                prefix: const Icon(
                  Icons.edit_outlined,
                  color: BookingMockStyle.accent,
                  size: 22,
                ),
              ).copyWith(
                counterText: '$notesLen/500',
                counterStyle: const TextStyle(
                  color: AppColors.muted,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
        ),
      ),
      const SizedBox(height: 18),
      const BookingInfoBanner(
        message:
            'Police report details are optional. You can continue without them.',
      ),
    ];
  }

  List<Widget> _lostAppointmentFields() {
    final districtOptions = ref.watch(centerDistrictsProvider);
    final selectedDistrict = _district.text.trim();
    final districtValue = districtOptions.contains(selectedDistrict)
        ? selectedDistrict
        : null;

    return [
      BookingDropdownField<String>(
        label: 'District Where You Live',
        boxed: true,
        value: districtValue,
        hint: 'Select your district',
        suffix: const Icon(
          Icons.keyboard_arrow_down_rounded,
          color: BookingMockStyle.accent,
        ),
        items: districtOptions
            .map(
              (district) =>
                  DropdownMenuItem(value: district, child: Text(district)),
            )
            .toList(),
        validator: (value) =>
            value == null || value.isEmpty ? 'Select your district' : null,
        onChanged: (value) {
          if (value == null) return;
          // Changing the district only reshuffles which center is flagged
          // "Recommended" below — an already-chosen center stays chosen,
          // since every center remains bookable regardless of district.
          setState(() => _district.text = value);
        },
      ),
      const SizedBox(height: 18),
      _CenterPicker(
        selected: _center,
        districtFilter: selectedDistrict.isEmpty ? null : selectedDistrict,
        onChanged: (center) => setState(() {
          _center = center;
          if (center.district.trim().isNotEmpty) {
            _district.text = center.district;
          }
          _selectedDate = null;
          _selectedSlot = null;
        }),
      ),
      const SizedBox(height: 18),
      _buildDateTimeSection(),
      const SizedBox(height: 18),
      const BookingInfoBanner(
        message: 'Select district, center, date and time to continue.',
      ),
    ];
  }

  List<Widget> _updateCitizenFields() {
    return [
      _fullNameField(),
      const SizedBox(height: 14),
      _phoneField(),
      const SizedBox(height: 14),
      TextFormField(
        controller: _nationalId,
        decoration: const InputDecoration(
          labelText: 'National ID number',
          prefixIcon: Icon(Icons.badge_outlined),
        ),
        validator: Validators.nationalId,
      ),
    ];
  }

  List<Widget> _updateDetailsFields() {
    return [
      _ChoiceField(
        label: 'Type of mistake',
        value: _mistakeType,
        options: const ['Document type', 'Office Mistake', 'Mixed Mistake'],
        onChanged: (value) => setState(() => _mistakeType = value),
      ),
      const SizedBox(height: 16),
      const Text(
        'Select fields to update',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 13.5,
          color: _ink,
        ),
      ),
      const SizedBox(height: 6),
      const Text(
        'Choose Name, Mother\'s Name, Age, District, and others — like the web form.',
        style: TextStyle(
          color: AppColors.muted,
          fontWeight: FontWeight.w600,
          fontSize: 12.5,
          height: 1.35,
        ),
      ),
      const SizedBox(height: 10),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final field in _updateFieldOptions)
            FilterChip(
              selected: _selectedUpdateFields.contains(field),
              label: Text(field),
              selectedColor: AppColors.primarySoft,
              checkmarkColor: AppColors.primary,
              labelStyle: TextStyle(
                fontWeight: FontWeight.w700,
                color: _selectedUpdateFields.contains(field)
                    ? AppColors.primary
                    : AppColors.ink,
                fontSize: 12.5,
              ),
              side: BorderSide(
                color: _selectedUpdateFields.contains(field)
                    ? AppColors.primary
                    : AppColors.lightBorder,
              ),
              onSelected: (_) => _toggleUpdateField(field),
            ),
        ],
      ),
      if (_selectedUpdateFields.contains('Other')) ...[
        const SizedBox(height: 12),
        TextFormField(
          initialValue: _otherFieldLabel,
          decoration: const InputDecoration(
            labelText: 'Other field name',
            hintText: 'e.g. Username',
          ),
          onChanged: (value) => _otherFieldLabel = value,
          validator: (value) {
            if (!_selectedUpdateFields.contains('Other')) return null;
            return Validators.notEmpty(value, 'Other field name');
          },
        ),
      ],
      const SizedBox(height: 16),
      for (final field in _selectedUpdateFields) ...[
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.lightBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                field == 'Other'
                    ? (_otherFieldLabel?.trim().isNotEmpty == true
                          ? _otherFieldLabel!.trim()
                          : 'Other')
                    : field,
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 12),
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Current value',
                  filled: true,
                  fillColor: Color(0xFFF3F4F6),
                ),
                child: Text(
                  _currentValueForUpdateField(field).isEmpty
                      ? 'Not recorded in current record'
                      : _currentValueForUpdateField(field),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.muted,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (field.toLowerCase().contains('marital'))
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(
                    labelText: 'Corrected value',
                  ),
                  items: [
                    if (_currentValueForUpdateField(field).toLowerCase() !=
                        'single')
                      const DropdownMenuItem(
                        value: 'SINGLE',
                        child: Text('Single'),
                      ),
                    if (_currentValueForUpdateField(field).toLowerCase() !=
                        'married')
                      const DropdownMenuItem(
                        value: 'MARRIED',
                        child: Text('Married'),
                      ),
                  ],
                  onChanged: (value) {
                    _updateNewValues[field]?.text = value ?? '';
                    setState(() {});
                  },
                  validator: (value) {
                    final text = _updateNewValues[field]?.text.trim() ?? '';
                    return text.isEmpty ? 'Select corrected value.' : null;
                  },
                )
              else
                TextFormField(
                  controller: _updateNewValues[field],
                  decoration: const InputDecoration(
                    labelText: 'Corrected value',
                  ),
                  validator: (value) =>
                      Validators.notEmpty(value, 'Corrected value'),
                ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _updateReasons[field],
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Reason for the correction',
                  alignLabelWithHint: true,
                ),
                validator: (value) => Validators.minLength(value, 5, 'Reason'),
              ),
            ],
          ),
        ),
      ],
      const SizedBox(height: 4),
      TextFormField(
        controller: _notes,
        maxLines: 2,
        decoration: const InputDecoration(
          labelText: 'Notes (optional)',
          alignLabelWithHint: true,
        ),
      ),
    ];
  }

  List<Widget> _defaultDetailsFields() {
    return [
      _fullNameField(),
      const SizedBox(height: 14),
      _phoneField(),
      const SizedBox(height: 14),
      _districtDropdownField(label: 'District'),
      const SizedBox(height: 14),
      TextFormField(
        controller: _notes,
        maxLines: 3,
        decoration: const InputDecoration(
          labelText: 'Tell us about your request (optional)',
          alignLabelWithHint: true,
        ),
      ),
    ];
  }

  Widget _fullNameField() {
    return TextFormField(
      controller: _fullName,
      textCapitalization: TextCapitalization.words,
      decoration: const InputDecoration(
        labelText: 'Full Name',
        hintText: 'Enter your full name',
      ),
      validator: (value) => Validators.minLength(value, 3, 'Full name'),
    );
  }

  Widget _phoneField({bool showHelper = false}) {
    return TextFormField(
      controller: _phone,
      keyboardType: TextInputType.number,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(9),
      ],
      decoration: InputDecoration(
        labelText: 'Phone',
        hintText: 'Enter your phone number',
        prefixIcon: const _PhonePrefix(),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        helperText: showHelper ? 'OTP confirmation code is sent here.' : null,
      ),
      validator: (value) => Validators.phone(value),
    );
  }

  Widget _districtDropdownField({required String label}) {
    final districtOptions = ref.watch(centerDistrictsProvider);
    final centersLoading = ref.watch(centersProvider).isLoading;
    final selectedDistrict = _district.text.trim();
    final districtValue = districtOptions.contains(selectedDistrict)
        ? selectedDistrict
        : null;

    if (centersLoading) {
      return InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: const Text('Loading districts from database...'),
      );
    }

    if (districtOptions.isEmpty) {
      return InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          errorText: 'No districts found. Add centers in Admin first.',
        ),
        child: const Text('No districts available'),
      );
    }

    return DropdownButtonFormField<String>(
      key: ValueKey('district-${districtValue ?? 'none'}'),
      initialValue: districtValue,
      decoration: InputDecoration(labelText: label),
      hint: const Text('Select your district'),
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _brand),
      isExpanded: true,
      items: districtOptions
          .map(
            (district) =>
                DropdownMenuItem(value: district, child: Text(district)),
          )
          .toList(),
      validator: (value) =>
          value == null || value.isEmpty ? 'Select your district' : null,
      onChanged: (value) {
        if (value == null) return;
        setState(() => _district.text = value);
      },
    );
  }

  Widget _reviewRow(String label, String value) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: _ink,
                    fontWeight: FontWeight.w700,
                    fontSize: 14.5,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  value.trim().isEmpty ? '--' : value,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontWeight: FontWeight.w600,
                    fontSize: 14.5,
                  ),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: Color(0xFFECECEC)),
      ],
    );
  }

  Widget _reviewCard(ServiceModel service) {
    final phone = Validators.normalizePhone(_phone.text);
    final dob = Formatters.parseApiDate(_dateOfBirth.text);
    final dobLabel = dob == null
        ? _dateOfBirth.text
        : Formatters.readableDate(Formatters.apiDate(dob));
    final isLost = service.requestType == RequestTypes.lostReplacement;
    final lostDateParsed = Formatters.parseApiDate(_dateLost.text);
    final lostDateLabel = lostDateParsed == null
        ? _dateLost.text
        : Formatters.readableDate(Formatters.apiDate(lostDateParsed));

    final rows = <Widget>[
      if (service.requestType == RequestTypes.newNationalId) ...[
        _reviewRow('Full Name', _fullName.text),
        _reviewRow('Mother Name', _motherName.text),
        _reviewRow('Date of Birth', dobLabel),
        _reviewRow('Age', _ageFromDob == null ? '--' : '${_ageFromDob!} Years'),
        _reviewRow('Phone', phone.isEmpty ? '--' : '+252 $phone'),
        _reviewRow('Gender', _gender ?? '--'),
        _reviewRow('Marital Status', _maritalStatus ?? '--'),
        _reviewRow('District', _district.text),
        _reviewRow('Landmark', _landmark.text),
        _reviewRow('Address', _address.text),
      ] else if (service.requestType == RequestTypes.lostReplacement) ...[
        _reviewRow(
          'National ID Number',
          _nationalId.text.trim().isEmpty ? '--' : _nationalId.text,
        ),
        _reviewRow('Full Name', _fullName.text),
        _reviewRow('Phone Number', phone.isEmpty ? '--' : '+252 $phone'),
        _reviewRow('Date Lost', lostDateLabel),
        _reviewRow('Place Lost', _placeLost.text),
        _reviewRow('Reason', _lostReason),
        _reviewRow(
          'Police Report Number',
          _policeReport.text.trim().isEmpty ? '--' : _policeReport.text,
        ),
        _reviewRow('Notes', _notes.text.trim().isEmpty ? '--' : _notes.text),
        _reviewRow('District Where You Live', _district.text),
      ] else if (service.requestType == RequestTypes.updateInformation) ...[
        _reviewRow('Full Name', _fullName.text),
        _reviewRow('Phone', phone.isEmpty ? '--' : '+252 $phone'),
        _reviewRow('National ID', _nationalId.text),
        _reviewRow('Mistake type', _mistakeType),
        for (final change in _buildUpdateChanges()) ...[
          _reviewRow('Field', change['field'] ?? '--'),
          _reviewRow('Current', change['currentValue'] ?? '--'),
          _reviewRow('New value', change['newValue'] ?? '--'),
          _reviewRow('Reason', change['reason'] ?? '--'),
        ],
        if (_notes.text.trim().isNotEmpty)
          _reviewRow('Notes', _notes.text.trim()),
      ] else ...[
        _reviewRow('Full Name', _fullName.text),
        _reviewRow('Phone', phone.isEmpty ? '--' : '+252 $phone'),
        _reviewRow('District', _district.text),
      ],
      _reviewRow('Center', _center?.name ?? '--'),
      _reviewRow(
        'Date',
        _selectedDate == null
            ? '--'
            : Formatters.readableDate(Formatters.apiDate(_selectedDate!)),
      ),
      _reviewRow('Time', _selectedSlot ?? '--'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isLost)
          Container(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BookingMockStyle.line),
            ),
            child: Column(children: rows),
          )
        else
          ...rows,
        const SizedBox(height: 18),
        InkWell(
          onTap: () => setState(() {
            _infoConfirmed = !_infoConfirmed;
            _error = null;
          }),
          borderRadius: BorderRadius.circular(8),
          child: Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: _infoConfirmed,
                  onChanged: (value) => setState(() {
                    _infoConfirmed = value ?? false;
                    _error = null;
                  }),
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'I confirm the information is correct',
                  style: TextStyle(
                    color: _ink,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDateTimeSection() {
    final query = _availabilityQuery;
    if (query == null) {
      return const Text(
        'Select a service center to see available dates and times.',
        style: TextStyle(color: AppColors.muted, height: 1.4),
      );
    }

    final availability = ref.watch(availabilityProvider(query));

    return availability.when(
      loading: () => const SizedBox(
        height: 74,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
      ),
      error: (error, _) => Column(
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
      data: (data) {
        final slots = _selectedDate == null
            ? <String>[]
            : data.slotsFor(_selectedDate!);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BookingLabeledField(
              label: 'Date',
              child: InkWell(
                onTap: () => _pickDate(data),
                child: InputDecorator(
                  decoration: BookingMockStyle.boxed(
                    hint: 'Select a date',
                    suffix: const Icon(
                      Icons.calendar_month_rounded,
                      color: BookingMockStyle.accent,
                      size: 20,
                    ),
                  ),
                  child: Text(
                    _selectedDate == null
                        ? 'Select a date'
                        : Formatters.readableDate(
                            Formatters.apiDate(_selectedDate!),
                          ),
                    style: TextStyle(
                      color: _selectedDate == null
                          ? BookingMockStyle.placeholder
                          : BookingMockStyle.ink,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 18),
            if (_selectedDate == null)
              BookingLabeledField(
                label: 'Time',
                child: InputDecorator(
                  decoration: BookingMockStyle.boxed(
                    hint: 'Select a time',
                    suffix: const Icon(
                      Icons.access_time_rounded,
                      color: BookingMockStyle.accent,
                      size: 20,
                    ),
                  ),
                  child: const Text(
                    'Select a time',
                    style: BookingMockStyle.hintStyle,
                  ),
                ),
              )
            else if (slots.isEmpty)
              BookingLabeledField(
                label: 'Time',
                child: InputDecorator(
                  decoration: BookingMockStyle.boxed(
                    errorText: 'No slots left on this date.',
                  ),
                  child: const Text('No time available'),
                ),
              )
            else
              BookingDropdownField<String>(
                label: 'Time',
                boxed: true,
                value: slots.contains(_selectedSlot) ? _selectedSlot : null,
                hint: 'Select a time',
                suffix: const Icon(
                  Icons.access_time_rounded,
                  color: BookingMockStyle.accent,
                  size: 20,
                ),
                items: slots
                    .map(
                      (slot) =>
                          DropdownMenuItem(value: slot, child: Text(slot)),
                    )
                    .toList(),
                validator: (value) => value == null || value.isEmpty
                    ? 'Select a time slot'
                    : null,
                onChanged: (value) => setState(() => _selectedSlot = value),
              ),
          ],
        );
      },
    );
  }
}

enum _BookingStepKind {
  newIdIdentity,
  newIdProfile,
  lostHolder,
  lostDetails,
  updateCitizen,
  updateDetails,
  defaultDetails,
  appointment,
  review,
}

class _BookingStep {
  const _BookingStep({
    required this.title,
    required this.stepLabel,
    required this.subtitle,
    required this.icon,
    required this.kind,
  });

  final String title;
  final String stepLabel;
  final String subtitle;
  final IconData icon;
  final _BookingStepKind kind;
}

class _CenterPicker extends ConsumerWidget {
  const _CenterPicker({
    required this.selected,
    required this.onChanged,
    this.districtFilter,
  });

  final CenterModel? selected;
  final ValueChanged<CenterModel> onChanged;
  final String? districtFilter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final centers = ref.watch(centersProvider);

    return centers.when(
      loading: () => const SizedBox(
        height: 48,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
      ),
      error: (error, _) => InlineErrorBanner(
        message: error is ApiException
            ? error.message
            : 'Could not load centers.',
      ),
      data: (all) {
        final filter = districtFilter?.trim().toLowerCase() ?? '';
        final active = all.where((center) => center.isActive).toList();
        if (active.isEmpty) {
          return const Text(
            'No service centers are open for booking right now.',
            style: TextStyle(color: AppColors.muted),
          );
        }
        // The selected district only picks which centers surface as
        // "Recommended" — every active center nationwide stays choosable, so
        // a district with no center of its own (or the wrong one for a
        // citizen who wants to book elsewhere) never blocks booking.
        bool isRecommended(CenterModel center) =>
            filter.isNotEmpty && center.district.trim().toLowerCase() == filter;
        final ordered = [
          ...active.where(isRecommended),
          ...active.where((center) => !isRecommended(center)),
        ];
        return BookingDropdownField<String>(
          label: 'Center',
          boxed: true,
          value: selected?.id,
          hint: 'Select your center',
          suffix: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: BookingMockStyle.accent,
          ),
          items: ordered
              .map(
                (center) => DropdownMenuItem(
                  value: center.id,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isRecommended(center)) ...[
                        const Icon(
                          Icons.star_rounded,
                          size: 15,
                          color: BookingMockStyle.accent,
                        ),
                        const SizedBox(width: 4),
                      ],
                      Flexible(
                        child: Text(
                          center.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
          validator: (value) =>
              value == null ? 'Choose the center you want to visit.' : null,
          onChanged: (value) {
            if (value == null) return;
            onChanged(ordered.firstWhere((center) => center.id == value));
          },
        );
      },
    );
  }
}

class _BirthDateField extends StatelessWidget {
  const _BirthDateField({
    required this.controller,
    required this.onTap,
    this.validator,
  });

  final TextEditingController controller;
  final Future<void> Function() onTap;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      validator: (_) => validator?.call(controller.text),
      builder: (state) {
        final parsed = Formatters.parseApiDate(controller.text);
        final display = parsed == null ? '' : Formatters.usDate(parsed);
        return BookingLabeledField(
          label: 'Date of Birth',
          child: InkWell(
            onTap: () async {
              await onTap();
              state.didChange(controller.text);
            },
            child: InputDecorator(
              decoration: BookingMockStyle.underline(
                hint: 'Select your date of birth',
                errorText: state.errorText,
                suffix: const Icon(
                  Icons.calendar_month_rounded,
                  size: 20,
                  color: BookingMockStyle.accent,
                ),
              ),
              child: Text(
                display.isEmpty ? 'Select your date of birth' : display,
                style: TextStyle(
                  color: display.isEmpty
                      ? BookingMockStyle.placeholder
                      : BookingMockStyle.ink,
                  fontWeight: display.isEmpty
                      ? FontWeight.w500
                      : FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        );
      },
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

class _PhonePrefix extends StatelessWidget {
  const _PhonePrefix();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Text(
        '+252',
        style: const TextStyle(
          color: BookingMockStyle.accent,
          fontWeight: FontWeight.w800,
          fontSize: 15,
        ),
      ),
    );
  }
}
