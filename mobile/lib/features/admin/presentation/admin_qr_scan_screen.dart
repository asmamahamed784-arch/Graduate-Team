import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/json_utils.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../data/admin_repository.dart';

class AdminQrScanScreen extends ConsumerStatefulWidget {
  const AdminQrScanScreen({super.key});

  @override
  ConsumerState<AdminQrScanScreen> createState() => _AdminQrScanScreenState();
}

class _AdminQrScanScreenState extends ConsumerState<AdminQrScanScreen> {
  final _manualController = TextEditingController();
  MobileScannerController? _scanner;
  bool _cameraFailed = false;
  bool _processing = false;
  String? _lastCode;

  @override
  void initState() {
    super.initState();
    _initScanner();
  }

  Future<void> _initScanner() async {
    try {
      final controller = MobileScannerController(detectionSpeed: DetectionSpeed.normal);
      setState(() {
        _scanner = controller;
        _cameraFailed = false;
      });
    } catch (_) {
      setState(() => _cameraFailed = true);
    }
  }

  @override
  void dispose() {
    _manualController.dispose();
    _scanner?.dispose();
    super.dispose();
  }

  Future<void> _handleCode(String raw) async {
    final code = raw.trim();
    if (code.isEmpty || _processing || code == _lastCode) return;

    setState(() {
      _processing = true;
      _lastCode = code;
    });

    try {
      final result = await ref.read(adminRepositoryProvider).verifyQr(code);
      if (!mounted) return;
      await _showResultDialog(code, result);
    } on ApiException catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    } finally {
      if (mounted) {
        setState(() {
          _processing = false;
          _lastCode = null;
        });
      }
    }
  }

  Future<void> _showResultDialog(String code, Map<String, dynamic> result) async {
    final reference = Json.str(result['reference'] ?? result['ref'], code);
    final status = Json.str(result['status'] ?? result['ticketStatus']);
    final citizen = Json.str(result['citizenName'] ?? result['name']);
    final service = Json.str(result['serviceName']);

    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('QR verification'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DetailRow(label: 'Reference', value: reference),
            if (citizen.isNotEmpty) DetailRow(label: 'Citizen', value: citizen),
            if (service.isNotEmpty) DetailRow(label: 'Service', value: service),
            if (status.isNotEmpty) DetailRow(label: 'Status', value: status),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _qrAction(code, 'cancel');
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _qrAction(code, 'arrive');
            },
            child: const Text('Arrive'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _qrAction(code, 'complete');
            },
            child: const Text('Complete'),
          ),
        ],
      ),
    );
  }

  Future<void> _qrAction(String code, String action) async {
    setState(() => _processing = true);
    try {
      await ref.read(adminRepositoryProvider).qrAction(code: code, action: action);
      if (mounted) showAppSnackBar(context, 'Action "$action" applied');
    } on ApiException catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.lightBackground,
      appBar: AppBar(
        title: const Text('QR Scan'),
        actions: [
          if (_scanner != null && !_cameraFailed)
            IconButton(
              onPressed: () => _scanner?.toggleTorch(),
              icon: const Icon(Icons.flash_on_rounded),
            ),
        ],
      ),
      body: Column(
        children: [
          if (_cameraFailed || _scanner == null)
            Expanded(child: _ManualEntry(onSubmit: _handleCode, controller: _manualController))
          else
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  MobileScanner(
                    controller: _scanner,
                    onDetect: (capture) {
                      final barcodes = capture.barcodes;
                      if (barcodes.isEmpty) return;
                      final value = barcodes.first.rawValue;
                      if (value != null) _handleCode(value);
                    },
                  ),
                  if (_processing)
                    Container(
                      color: Colors.black45,
                      child: const Center(child: CircularProgressIndicator(color: Colors.white)),
                    ),
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 16,
                    child: SectionCard(
                      padding: const EdgeInsets.all(12),
                      child: TextField(
                        controller: _manualController,
                        decoration: InputDecoration(
                          hintText: 'Or paste reference manually',
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.search_rounded),
                            onPressed: () => _handleCode(_manualController.text),
                          ),
                          border: InputBorder.none,
                        ),
                        onSubmitted: _handleCode,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (!_cameraFailed && _scanner != null)
            TextButton.icon(
              onPressed: () {
                _scanner?.dispose();
                setState(() {
                  _scanner = null;
                  _cameraFailed = true;
                });
              },
              icon: const Icon(Icons.keyboard_rounded),
              label: const Text('Use manual entry instead'),
            ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _ManualEntry extends StatelessWidget {
  const _ManualEntry({required this.onSubmit, required this.controller});

  final Future<void> Function(String code) onSubmit;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.qr_code_scanner_rounded, size: 48, color: AppColors.muted),
          const SizedBox(height: 12),
          const Text(
            'Camera unavailable',
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const SizedBox(height: 8),
          const Text(
            'Paste a ticket reference below to verify and take action.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Reference / QR code',
              border: OutlineInputBorder(),
            ),
            onSubmitted: onSubmit,
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => onSubmit(controller.text),
            child: const Text('Verify'),
          ),
        ],
      ),
    );
  }
}
