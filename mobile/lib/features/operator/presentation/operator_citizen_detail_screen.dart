import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/appointment.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../data/operator_repository.dart';
import 'widgets/operator_ticket_tile.dart';

class OperatorCitizenDetailScreen extends ConsumerStatefulWidget {
  const OperatorCitizenDetailScreen({super.key});

  @override
  ConsumerState<OperatorCitizenDetailScreen> createState() =>
      _OperatorCitizenDetailScreenState();
}

class _OperatorCitizenDetailScreenState
    extends ConsumerState<OperatorCitizenDetailScreen> {
  final _referenceController = TextEditingController();
  bool _loading = false;
  Appointment? _appointment;
  String? _error;

  @override
  void dispose() {
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final reference = _referenceController.text.trim();
    if (reference.isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
      _appointment = null;
    });

    try {
      final result =
          await ref.read(operatorRepositoryProvider).lookupByReference(reference);
      if (mounted) setState(() => _appointment = result);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Citizen Details')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _referenceController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Reference number',
                    hintText: 'REQ-1234',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                  onSubmitted: (_) => _lookup(),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _loading ? null : _lookup,
                  icon: _loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.person_search_rounded),
                  label: const Text('Look up'),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            InlineErrorBanner(message: _error!),
          ],
          if (_appointment != null) ...[
            const SizedBox(height: 20),
            OperatorTicketTile(ticket: _appointment!, highlight: true),
            const SizedBox(height: 14),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Reference',
                    value: _appointment!.reference,
                    icon: Icons.confirmation_number_outlined,
                    copyable: true,
                  ),
                  DetailRow(
                    label: 'Citizen',
                    value: _appointment!.citizenName.isNotEmpty
                        ? _appointment!.citizenName
                        : '--',
                    icon: Icons.person_outline_rounded,
                  ),
                  DetailRow(
                    label: 'Service',
                    value: _appointment!.serviceName.isNotEmpty
                        ? _appointment!.serviceName
                        : _appointment!.requestTypeLabel,
                    icon: Icons.miscellaneous_services_outlined,
                  ),
                  DetailRow(
                    label: 'Center',
                    value: _appointment!.centerName.isNotEmpty
                        ? _appointment!.centerName
                        : '--',
                    icon: Icons.location_city_outlined,
                  ),
                  DetailRow(
                    label: 'Status',
                    value: _appointment!.status,
                    icon: Icons.info_outline_rounded,
                  ),
                  DetailRow(
                    label: 'Request status',
                    value: _appointment!.requestStatus,
                    icon: Icons.fact_check_outlined,
                  ),
                  if (_appointment!.hasAppointmentSlot) ...[
                    DetailRow(
                      label: 'Date',
                      value: Formatters.readableDate(_appointment!.date),
                      icon: Icons.event_outlined,
                    ),
                    if (_appointment!.timeSlot != null)
                      DetailRow(
                        label: 'Time slot',
                        value: _appointment!.timeSlot!,
                        icon: Icons.schedule_rounded,
                      ),
                  ],
                  if (_appointment!.nationalIdNumber.isNotEmpty)
                    DetailRow(
                      label: 'National ID',
                      value: _appointment!.nationalIdNumber,
                      icon: Icons.badge_outlined,
                    ),
                  if (_appointment!.counter != '--')
                    DetailRow(
                      label: 'Counter',
                      value: _appointment!.counter,
                      icon: Icons.desktop_windows_outlined,
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
