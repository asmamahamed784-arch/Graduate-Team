import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/nqs_page_header.dart';

/// Contact details corroborated against the web app (`ContactSection.jsx`) —
/// not the mobile-only phone number that used to live here, which appeared
/// nowhere else in the codebase.
const _supportPhone = '+252 61 000 1000';
const _supportPhoneDial = 'tel:+252610001000';
const _supportEmail = 'support@nqs.gov.so';
const _supportWhatsApp = 'https://wa.me/252610001000';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  static const _faqs = [
    (
      q: 'How do I book a National ID appointment?',
      a: 'Open Services, choose a service, review the details, then tap Start Application and complete the steps.',
    ),
    (
      q: 'What is the QR Request for?',
      a: 'Show the QR code at the service center so a kiosk or operator can check you in.',
    ),
    (
      q: 'Why do I need OTP?',
      a: 'OTP confirms it is you before the request is submitted to the National Queue System.',
    ),
    (
      q: 'Can I update or replace my ID?',
      a: 'Yes — after your New Registration is marked Completed, Update Information and Lost ID Replacement open.',
    ),
    (
      q: 'How do I track the queue?',
      a: 'Use Track Queue from Services or Home, then enter your request reference.',
    ),
    (
      q: 'How can I reschedule or cancel my appointment?',
      a: 'Open Appointments, select the appointment, then use Reschedule or Cancel — cancellation is only available within 1 hour of booking.',
    ),
  ];

  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<({String q, String a})> get _filteredFaqs {
    if (_query.isEmpty) return _faqs;
    final q = _query.toLowerCase();
    return _faqs.where((f) => f.q.toLowerCase().contains(q) || f.a.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final faqs = _filteredFaqs;

    return Scaffold(
      backgroundColor: AppSurface.background(context),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: [
          NqsPageHeader(
            icon: Icons.help_rounded,
            iconColor: AppColors.warning,
            title: 'Help & Support',
            subtitle: "We're here to help. Find answers or get in touch.",
            onMenu: () => Navigator.of(context).maybePop(),
            bell: IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.close_rounded),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            onChanged: (value) => setState(() => _query = value.trim()),
            decoration: InputDecoration(
              hintText: 'Search help topics, e.g. appointments, documents…',
              hintStyle: const TextStyle(fontSize: 13),
              prefixIcon: const Icon(Icons.search_rounded, color: AppColors.muted),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.lightBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.lightBorder),
              ),
            ),
          ),
          const SizedBox(height: 18),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.82,
            children: [
              _QuickAction(
                icon: Icons.call_rounded,
                color: AppColors.success,
                label: 'Call\nSupport',
                onTap: () => launchUrl(Uri.parse(_supportPhoneDial)),
              ),
              _QuickAction(
                icon: Icons.chat_rounded,
                color: const Color(0xFF25D366),
                label: 'WhatsApp',
                onTap: () => launchUrl(
                  Uri.parse(_supportWhatsApp),
                  mode: LaunchMode.externalApplication,
                ),
              ),
              _QuickAction(
                icon: Icons.mail_rounded,
                color: AppColors.primary,
                label: 'Email',
                onTap: () => launchUrl(Uri.parse('mailto:$_supportEmail')),
              ),
              _QuickAction(
                icon: Icons.quiz_rounded,
                color: const Color(0xFF7C3AED),
                label: 'FAQ',
                onTap: () => _searchController.clear(),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'Frequently Asked Questions',
            style: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w800, fontSize: 15),
          ),
          const SizedBox(height: 10),
          if (faqs.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text(
                'No help topics match your search.',
                style: TextStyle(color: AppColors.muted),
              ),
            )
          else
            for (final faq in faqs) ...[
              Card(
                elevation: 0,
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: AppColors.lightBorder),
                ),
                child: ExpansionTile(
                  tilePadding: const EdgeInsets.symmetric(horizontal: 14),
                  childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                  title: Text(
                    faq.q,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: AppColors.ink,
                    ),
                  ),
                  children: [
                    Text(
                      faq.a,
                      style: const TextStyle(
                        color: AppColors.muted,
                        height: 1.45,
                        fontSize: 13.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 10),
          const Text(
            'Contact Information',
            style: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w800, fontSize: 15),
          ),
          const SizedBox(height: 10),
          _ActionTile(
            icon: Icons.phone_outlined,
            title: 'Phone',
            subtitle: _supportPhone,
            onTap: () => launchUrl(Uri.parse(_supportPhoneDial)),
          ),
          const SizedBox(height: 8),
          _ActionTile(
            icon: Icons.mail_outline_rounded,
            title: 'Email',
            subtitle: _supportEmail,
            onTap: () => launchUrl(Uri.parse('mailto:$_supportEmail')),
          ),
          const SizedBox(height: 8),
          _ActionTile(
            icon: Icons.report_gmailerrorred_outlined,
            title: 'Report a problem',
            subtitle: 'Tell us what went wrong in the app',
            onTap: () => launchUrl(
              Uri.parse('mailto:$_supportEmail?subject=NQS%20Mobile%20App%20Issue'),
            ),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.12)),
            ),
            child: Row(
              children: [
                const Icon(Icons.support_agent_rounded, color: AppColors.primary, size: 30),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Need more help?',
                        style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.navy),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Our support team is ready to assist you by phone or email.',
                        style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.3),
                      ),
                    ],
                  ),
                ),
                FilledButton(
                  onPressed: () => launchUrl(Uri.parse(_supportPhoneDial)),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    textStyle: const TextStyle(fontSize: 12.5),
                  ),
                  child: const Text('Call Us'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      radius: 16,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      tintColor: color,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SoftIconBadge(icon: icon, color: color, size: 34),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, height: 1.15),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      radius: 16,
      child: Row(
        children: [
          SoftIconBadge(icon: icon, color: AppColors.primary, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
        ],
      ),
    );
  }
}
