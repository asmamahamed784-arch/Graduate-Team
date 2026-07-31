import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/env.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../auth/application/auth_controller.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeControllerProvider);
    final controller = ref.read(themeControllerProvider.notifier);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
        children: [
          const SectionHeader(title: 'Appearance'),
          SectionCard(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: RadioGroup<ThemeMode>(
              groupValue: themeMode,
              onChanged: (value) {
                if (value != null) controller.set(value);
              },
              child: Column(
                children: ThemeMode.values
                    .map(
                      (mode) => RadioListTile<ThemeMode>(
                        value: mode,
                        title: Text(_label(mode)),
                        subtitle: Text(_description(mode)),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
          const SizedBox(height: 24),
          const SectionHeader(title: 'Account'),
          SectionCard(
            child: Column(
              children: [
                DetailRow(
                  label: 'Username',
                  value: user?.username ?? '--',
                  icon: Icons.person_outline_rounded,
                ),
                DetailRow(
                  label: 'Role',
                  value: user == null ? '--' : 'Citizen',
                  icon: Icons.verified_user_outlined,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const SectionHeader(title: 'About'),
          SectionCard(
            child: Column(
              children: [
                const Row(
                  children: [
                    BrandLogo(size: 44, showText: true),
                  ],
                ),
                const SizedBox(height: 14),
                const Divider(),
                const DetailRow(
                  label: 'App version',
                  value: '1.0.0',
                  icon: Icons.info_outline_rounded,
                ),
                DetailRow(
                  label: 'Connected to',
                  value: Env.apiBaseUrl,
                  icon: Icons.cloud_outlined,
                ),
                const DetailRow(
                  label: 'System',
                  value: AppConstants.appTagline,
                  icon: Icons.account_balance_outlined,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const Center(
            child: Text(
              'This app uses the same secure NQS services as the web portal.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  String _label(ThemeMode mode) => switch (mode) {
        ThemeMode.system => 'Match system',
        ThemeMode.light => 'Light',
        ThemeMode.dark => 'Dark',
      };

  String _description(ThemeMode mode) => switch (mode) {
        ThemeMode.system => 'Follow your device appearance setting.',
        ThemeMode.light => 'Bright theme, best in daylight.',
        ThemeMode.dark => 'Dimmed theme, easier on the eyes at night.',
      };
}
