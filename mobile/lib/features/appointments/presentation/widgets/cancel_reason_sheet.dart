import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

const kCancelReasons = [
  'Schedule conflict',
  'Cannot attend on this date',
  'Wrong information submitted',
  'Found my National ID',
  'Personal emergency',
  'Other',
];

/// Returns the selected cancel reason, or null if dismissed.
Future<String?> showCancelReasonSheet(
  BuildContext context, {
  required String reference,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) => _CancelReasonSheet(reference: reference),
  );
}

class _CancelReasonSheet extends StatefulWidget {
  const _CancelReasonSheet({required this.reference});

  final String reference;

  @override
  State<_CancelReasonSheet> createState() => _CancelReasonSheetState();
}

class _CancelReasonSheetState extends State<_CancelReasonSheet> {
  String? _reason = kCancelReasons.first;
  final _otherController = TextEditingController();

  @override
  void dispose() {
    _otherController.dispose();
    super.dispose();
  }

  void _confirm() {
    final other = _otherController.text.trim();
    if (_reason == 'Other') {
      if (other.isEmpty) return;
      Navigator.of(context).pop(other);
      return;
    }
    Navigator.of(context).pop(_reason);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.lightBorder,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Cancel appointment',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: AppColors.navy,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Reference ${widget.reference} will be cancelled. Choose a reason.',
            style: const TextStyle(color: AppColors.muted, height: 1.4),
          ),
          const SizedBox(height: 14),
          for (final reason in kCancelReasons)
            ListTile(
              contentPadding: EdgeInsets.zero,
              onTap: () => setState(() => _reason = reason),
              leading: Icon(
                _reason == reason
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_off_rounded,
                color: _reason == reason ? AppColors.primary : AppColors.muted,
              ),
              title: Text(
                reason,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          if (_reason == 'Other') ...[
            TextField(
              controller: _otherController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Tell us more',
                hintText: 'Enter your reason',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 8),
          SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: (_reason == 'Other' &&
                      _otherController.text.trim().isEmpty)
                  ? null
                  : _confirm,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.danger,
              ),
              child: const Text(
                'Confirm cancellation',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Keep appointment'),
          ),
        ],
      ),
    );
  }
}
