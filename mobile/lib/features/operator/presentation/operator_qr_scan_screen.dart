import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../../shared/widgets/state_views.dart';
import '../application/operator_controller.dart';
import '../data/operator_repository.dart';

class OperatorQrScanScreen extends ConsumerStatefulWidget {
  const OperatorQrScanScreen({super.key});

  @override
  ConsumerState<OperatorQrScanScreen> createState() => _OperatorQrScanScreenState();
}

class _OperatorQrScanScreenState extends ConsumerState<OperatorQrScanScreen> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.normal);
  bool _processing = false;
  String? _lastCode;
  Map<String, dynamic>? _verifyResult;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final value = capture.barcodes.firstOrNull?.rawValue?.trim();
    if (value == null || value.isEmpty || value == _lastCode) return;

    setState(() {
      _processing = true;
      _lastCode = value;
      _error = null;
    });

    try {
      final result = await ref.read(operatorRepositoryProvider).verifyQr(value);
      if (mounted) {
        setState(() => _verifyResult = result);
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
          _verifyResult = null;
        });
      }
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _qrAction(String action) async {
    if (_lastCode == null || _processing) return;
    setState(() => _processing = true);
    try {
      await ref.read(operatorRepositoryProvider).qrAction(
            code: _lastCode!,
            action: action,
          );
      refreshOperatorData(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('QR action "$action" completed.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  void _resetScan() {
    setState(() {
      _lastCode = null;
      _verifyResult = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('QR Scanner'),
        actions: [
          IconButton(
            tooltip: 'Toggle torch',
            onPressed: () => _controller.toggleTorch(),
            icon: const Icon(Icons.flash_on_outlined),
          ),
          IconButton(
            tooltip: 'Switch camera',
            onPressed: () => _controller.switchCamera(),
            icon: const Icon(Icons.cameraswitch_outlined),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            flex: 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                ),
                if (_processing)
                  Container(
                    color: Colors.black38,
                    alignment: Alignment.center,
                    child: const CircularProgressIndicator(color: Colors.white),
                  ),
              ],
            ),
          ),
          Expanded(
            flex: 2,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null) InlineErrorBanner(message: _error!),
                if (_verifyResult != null) ...[
                  SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _verifyResult!['ref']?.toString() ??
                              _verifyResult!['reference']?.toString() ??
                              _lastCode ??
                              'Ticket',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (_verifyResult!['citizenName'] != null)
                          DetailRow(
                            label: 'Citizen',
                            value: '${_verifyResult!['citizenName']}',
                            icon: Icons.person_outline_rounded,
                          ),
                        if (_verifyResult!['status'] != null)
                          DetailRow(
                            label: 'Status',
                            value: '${_verifyResult!['status']}',
                            icon: Icons.info_outline_rounded,
                          ),
                        if (_verifyResult!['serviceName'] != null)
                          DetailRow(
                            label: 'Service',
                            value: '${_verifyResult!['serviceName']}',
                            icon: Icons.miscellaneous_services_outlined,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _processing ? null : () => _qrAction('arrive'),
                          icon: const Icon(Icons.login_rounded),
                          label: const Text('Mark arrived'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _resetScan,
                          child: const Text('Scan again'),
                        ),
                      ),
                    ],
                  ),
                ] else if (_error == null)
                  const EmptyStateView(
                    icon: Icons.qr_code_scanner_rounded,
                    title: 'Scan a ticket QR code',
                    message: 'Point the camera at the citizen\'s ticket to verify and check them in.',
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
