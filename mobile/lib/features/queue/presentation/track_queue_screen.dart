import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/storage/app_prefs.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/queue_status.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/nqs_page_header.dart';
import '../../../shared/widgets/state_views.dart';
import '../../appointments/application/appointments_controller.dart';
import '../application/queue_controller.dart';

/// Live queue position for a ticket reference, refreshed by Socket.IO pushes
/// and a 15 second poll. Lookup is by ticket reference only — the backend's
/// `GET /api/queue/track/:ref` matches on the ticket's unique `ref` field
/// alone, so there's no real phone-number or queue-number search to offer.
class TrackQueueScreen extends ConsumerStatefulWidget {
  const TrackQueueScreen({super.key, this.initialReference});

  final String? initialReference;

  @override
  ConsumerState<TrackQueueScreen> createState() => _TrackQueueScreenState();
}

class _TrackQueueScreenState extends ConsumerState<TrackQueueScreen> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialReference ?? '');
  String? _reference;

  @override
  void initState() {
    super.initState();
    _reference = widget.initialReference?.trim().toUpperCase();
    if (_reference == null || _reference!.isEmpty) {
      // Default to the citizen's own active ticket when none was passed in.
      final current = ref.read(currentAppointmentProvider);
      if (current != null && current.isTrackable) {
        _reference = current.reference;
        _controller.text = current.reference;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _track() {
    final value = _controller.text.trim().toUpperCase();
    if (value.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() => _reference = value);
  }

  void _trackFromHistory(String reference) {
    _controller.text = reference;
    FocusScope.of(context).unfocus();
    setState(() => _reference = reference);
  }

  Future<void> _remember(QueueStatus data) async {
    await ref.read(appPrefsProvider).addRecentQueueSearch(
          RecentQueueSearch(
            reference: data.reference,
            centerName: data.centerName,
            serviceName: data.serviceName,
            searchedAt: DateTime.now(),
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final reference = _reference;

    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: NqsPageHeader(
                icon: Icons.groups_2_rounded,
                iconColor: const Color(0xFF5B2B9B),
                title: 'Track Queue',
                subtitle: 'Check your live queue status',
                onMenu: () => Navigator.of(context).maybePop(),
                bell: const HeaderBackButton(),
              ),
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      textCapitalization: TextCapitalization.characters,
                      onSubmitted: (_) => _track(),
                      decoration: const InputDecoration(
                        labelText: 'Request reference number',
                        hintText: 'REQ-1234',
                        prefixIcon: Icon(Icons.confirmation_number_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    height: 54,
                    child: FilledButton(
                      onPressed: _track,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.navy,
                        minimumSize: const Size(84, 54),
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text('Search'),
                    ),
                  ),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Use the reference from your booking confirmation or QR Request.',
                  style: TextStyle(color: AppColors.muted, fontSize: 11.5),
                ),
              ),
            ),
            Expanded(
              child: reference == null || reference.isEmpty
                  ? _RecentSearchesView(onSearch: _trackFromHistory)
                  : _QueueStatusView(reference: reference, onData: _remember),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small back arrow reused as the header's trailing slot — Track Queue is
/// always reached by a push (bottom tab, a card's "Track" button, a
/// notification), never a persisted tab, so a back action is always correct
/// here instead of the bell shown on other main pages.
class HeaderBackButton extends StatelessWidget {
  const HeaderBackButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: () => Navigator.of(context).maybePop(),
      icon: const Icon(Icons.close_rounded),
      tooltip: 'Close',
    );
  }
}

class _RecentSearchesView extends ConsumerWidget {
  const _RecentSearchesView({required this.onSearch});

  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(appPrefsProvider).recentQueueSearches;

    if (recent.isEmpty) {
      return const EmptyStateView(
        icon: Icons.groups_2_outlined,
        title: 'Enter your request reference',
        message:
            'Use the reference on your booking confirmation, for example REQ-1234.',
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recent Searches',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5),
            ),
            TextButton(
              onPressed: () =>
                  ref.read(appPrefsProvider).clearRecentQueueSearches().then(
                        (_) => ref.invalidate(appPrefsProvider),
                      ),
              child: const Text('Clear All'),
            ),
          ],
        ),
        const SizedBox(height: 6),
        for (final search in recent)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AppCard(
              onTap: () => onSearch(search.reference),
              radius: 14,
              child: Row(
                children: [
                  const SoftIconBadge(
                    icon: Icons.history_rounded,
                    color: AppColors.muted,
                    size: 34,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          search.reference,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                        if (search.centerName.isNotEmpty ||
                            search.serviceName.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            [
                              search.centerName,
                              search.serviceName,
                            ].where((s) => s.isNotEmpty).join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Text(
                    Formatters.relative(search.searchedAt),
                    style: const TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                  const SizedBox(width: 6),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _QueueStatusView extends ConsumerWidget {
  const _QueueStatusView({required this.reference, required this.onData});

  final String reference;
  final ValueChanged<QueueStatus> onData;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(queueTrackingProvider(reference));

    ref.listen(queueTrackingProvider(reference), (previous, next) {
      final data = next.asData?.value;
      if (data == null) return;
      final previousReference = previous?.asData?.value.reference;
      if (previousReference != data.reference) onData(data);
    });

    return status.when(
      loading: () => const LoadingView(message: 'Checking the queue'),
      error: (error, _) => ErrorStateView(
        error: error,
        onRetry: () => ref.invalidate(queueTrackingProvider(reference)),
      ),
      data: (data) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(queueTrackingProvider(reference)),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Current Queue',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            data.reference,
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 22,
                              color: AppColors.navy,
                            ),
                          ),
                          const SizedBox(width: 6),
                          InkWell(
                            onTap: () async {
                              await Clipboard.setData(
                                ClipboardData(text: data.reference),
                              );
                              if (context.mounted) {
                                showAppSnackBar(context, 'Reference copied.');
                              }
                            },
                            child: const Icon(
                              Icons.copy_rounded,
                              size: 17,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                StatusChip(status: data.status),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 14,
              runSpacing: 4,
              children: [
                if (data.centerName.isNotEmpty)
                  _MetaBit(icon: Icons.location_city_rounded, text: data.centerName),
                if (data.serviceName.isNotEmpty)
                  _MetaBit(icon: Icons.assignment_outlined, text: data.serviceName),
              ],
            ),
            const SizedBox(height: 20),
            SectionCard(child: _QueueStepper(status: data)),
            const SizedBox(height: 16),
            const Text(
              'Live Queue Status',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5),
            ),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.7,
              children: [
                _LiveStatBox(
                  icon: Icons.campaign_outlined,
                  color: AppColors.info,
                  label: 'Now Serving',
                  value: data.nowServing?.reference.isNotEmpty == true
                      ? data.nowServing!.reference
                      : (data.isBeingServed ? data.reference : '--'),
                ),
                _LiveStatBox(
                  icon: Icons.groups_outlined,
                  color: const Color(0xFF5B2B9B),
                  label: 'People Ahead',
                  value: '${data.peopleAhead}',
                ),
                _LiveStatBox(
                  icon: Icons.hourglass_bottom_rounded,
                  color: AppColors.success,
                  label: 'Estimated Wait',
                  value: data.estimatedWait,
                ),
                _LiveStatBox(
                  icon: Icons.desk_outlined,
                  color: AppColors.warning,
                  label: 'Current Counter',
                  value: data.counter,
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 15, color: AppColors.muted),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Queue status updates automatically. Please check the counter display at the center for your turn.',
                    style: TextStyle(color: AppColors.muted, fontSize: 11.5),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SectionCard(
              child: Column(
                children: [
                  DetailRow(
                    label: 'Service',
                    value: data.serviceName,
                    icon: Icons.assignment_outlined,
                  ),
                  DetailRow(
                    label: 'Date',
                    value: Formatters.readableDate(data.appointmentDate),
                    icon: Icons.event_outlined,
                  ),
                  DetailRow(
                    label: 'Time',
                    value: data.timeSlot ?? '--',
                    icon: Icons.schedule_rounded,
                  ),
                ],
              ),
            ),
            if (data.isFinished) ...[
              const SizedBox(height: 16),
              SectionCard(
                child: Row(
                  children: [
                    Icon(
                      data.status == TicketStatus.completed
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded,
                      color: data.status == TicketStatus.completed
                          ? AppColors.success
                          : AppColors.danger,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        data.status == TicketStatus.completed
                            ? 'This appointment is Completed. No further queue waiting.'
                            : 'This appointment is Cancelled.',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => context.push(AppRoutes.ticket(data.reference)),
              icon: const Icon(Icons.qr_code_2_rounded, size: 19),
              label: const Text('Show QR Request'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetaBit extends StatelessWidget {
  const _MetaBit({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.muted),
        const SizedBox(width: 5),
        Text(
          text,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _QueueStepper extends StatelessWidget {
  const _QueueStepper({required this.status});

  final QueueStatus status;

  static const _steps = [
    (label: 'Booked', icon: Icons.event_available_rounded),
    (label: 'Waiting', icon: Icons.groups_2_rounded),
    (label: 'Now Serving', icon: Icons.campaign_rounded),
    (label: 'Completed', icon: Icons.flag_rounded),
  ];

  int get _activeIndex {
    if (status.status == TicketStatus.cancelled) return -1;
    if (status.isFinished) return 3;
    if (status.isBeingServed) return 2;
    if (status.isWaiting) return 1;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeIndex;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < _steps.length; i++) ...[
          _StepDot(
            label: _steps[i].label,
            icon: _steps[i].icon,
            state: active < 0
                ? _StepState.idle
                : i < active
                ? _StepState.done
                : i == active
                ? _StepState.active
                : _StepState.idle,
          ),
          if (i != _steps.length - 1)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.only(top: 17),
                color: active >= 0 && i < active
                    ? AppColors.primary
                    : AppColors.lightBorder,
              ),
            ),
        ],
      ],
    );
  }
}

enum _StepState { done, active, idle }

class _StepDot extends StatelessWidget {
  const _StepDot({required this.label, required this.icon, required this.state});

  final String label;
  final IconData icon;
  final _StepState state;

  @override
  Widget build(BuildContext context) {
    final color = switch (state) {
      _StepState.done => AppColors.primary,
      _StepState.active => AppColors.navy,
      _StepState.idle => AppColors.lightBorder,
    };
    final iconColor = state == _StepState.idle ? AppColors.muted : Colors.white;

    return Column(
      children: [
        Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          child: Icon(
            state == _StepState.done ? Icons.check_rounded : icon,
            size: 17,
            color: iconColor,
          ),
        ),
        const SizedBox(height: 6),
        SizedBox(
          width: 66,
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: state == _StepState.idle
                  ? FontWeight.w600
                  : FontWeight.w800,
              color: state == _StepState.idle ? AppColors.muted : AppColors.ink,
            ),
          ),
        ),
      ],
    );
  }
}

class _LiveStatBox extends StatelessWidget {
  const _LiveStatBox({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      radius: 14,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      tintColor: color,
      child: Row(
        children: [
          SoftIconBadge(icon: icon, color: color, size: 32),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
