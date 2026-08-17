import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_surfaces.dart';
import '../../../shared/widgets/common_widgets.dart';
import '../../auth/application/auth_controller.dart';

const _supportPhone = '+252 61 000 1000';
const _supportPhoneDial = 'tel:+252610001000';
const _supportEmail = 'support@nqs.gov.so';
const _fallbackEmail = 'contact@nqs.gov.so';
const _messageMaxLength = 1000;

class ContactScreen extends ConsumerStatefulWidget {
  const ContactScreen({super.key});

  @override
  ConsumerState<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends ConsumerState<ContactScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fillFromProfile());
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  void _fillFromProfile() {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    if (_nameController.text.trim().isEmpty) {
      _nameController.text = user.displayName;
    }
    if (_phoneController.text.trim().isEmpty) {
      _phoneController.text = user.phone;
    }
  }

  Future<void> _submit() async {
    final formOk = _formKey.currentState?.validate() ?? false;
    if (!formOk) return;

    final user = ref.read(currentUserProvider);
    final email = (user?.email?.trim().isNotEmpty ?? false)
        ? user!.email!.trim()
        : _fallbackEmail;

    setState(() => _submitting = true);
    try {
      await ref
          .read(apiClientProvider)
          .post(
            ApiEndpoints.contact,
            body: {
              'fullName': _nameController.text.trim(),
              'email': email,
              'phone': _phoneController.text.trim(),
              'subject': _subjectController.text.trim(),
              'message': _messageController.text.trim(),
            },
          );
      if (!mounted) return;
      showAppSnackBar(context, 'Your message has been sent successfully.');
      _formKey.currentState?.reset();
      _subjectController.clear();
      _messageController.clear();
      _fillFromProfile();
    } on ApiException catch (error) {
      if (!mounted) return;
      showAppSnackBar(context, error.message, isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final isDark = AppSurface.isDark(context);

    return Scaffold(
      backgroundColor: AppSurface.background(context),
      body: Column(
        children: [
          _ContactAppBar(topPadding: top),
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                16,
                0,
                16,
                22 + MediaQuery.paddingOf(context).bottom,
              ),
              children: [
                const _HelpHero(),
                const SizedBox(height: 14),
                _QuickContactGrid(
                  onPhone: () => launchUrl(Uri.parse(_supportPhoneDial)),
                  onEmail: () => launchUrl(Uri.parse('mailto:$_supportEmail')),
                  onCenters: () => context.push(AppRoutes.centers),
                ),
                const SizedBox(height: 16),
                Form(
                  key: _formKey,
                  child: _MessageCard(
                    nameController: _nameController,
                    phoneController: _phoneController,
                    subjectController: _subjectController,
                    messageController: _messageController,
                    submitting: _submitting,
                    onSubmit: _submit,
                    onMessageChanged: () => setState(() {}),
                  ),
                ),
                const SizedBox(height: 16),
                const _SupportInfoCard(),
                const SizedBox(height: 14),
                _ContactFooter(isDark: isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactAppBar extends StatelessWidget {
  const _ContactAppBar({required this.topPadding});

  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(4, topPadding + 8, 16, 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0B55C4), Color(0xFF0646A8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () {
              if (!Navigator.of(context).canPop()) {
                context.go(AppRoutes.profile);
                return;
              }
              Navigator.of(context).maybePop();
            },
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          ),
          const Expanded(
            child: Text(
              'Contact Us',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _HelpHero extends StatelessWidget {
  const _HelpHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(0, 0, 0, 0),
      padding: const EdgeInsets.fromLTRB(16, 22, 14, 22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: AppSurface.isDark(context)
              ? [const Color(0xFF0F274C), const Color(0xFF0B1220)]
              : [const Color(0xFFEAF4FF), const Color(0xFFF8FBFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'We are here to help',
                  style: TextStyle(
                    color: AppSurface.isDark(context)
                        ? Colors.white
                        : AppColors.navyDeep,
                    fontSize: 22,
                    height: 1.15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  "Have a question or need assistance?\nReach out to us and we'll get back\nto you as soon as possible.",
                  style: TextStyle(
                    color: AppSurface.muted(context),
                    fontSize: 13,
                    height: 1.45,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 116,
            height: 116,
            child: CustomPaint(
              painter: _HeroSupportPainter(
                color: AppSurface.isDark(context)
                    ? const Color(0xFF7CB7FF)
                    : AppColors.primary,
                pale: AppSurface.isDark(context)
                    ? Colors.white.withValues(alpha: 0.08)
                    : const Color(0xFFDCEBFF),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroSupportPainter extends CustomPainter {
  const _HeroSupportPainter({required this.color, required this.pale});

  final Color color;
  final Color pale;

  @override
  void paint(Canvas canvas, Size size) {
    final palePaint = Paint()..color = pale;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    final fill = Paint()..color = color;
    final white = Paint()..color = Colors.white.withValues(alpha: 0.92);

    final building = Path()
      ..moveTo(size.width * 0.64, size.height * 0.72)
      ..lineTo(size.width * 0.64, size.height * 0.45)
      ..quadraticBezierTo(
        size.width * 0.74,
        size.height * 0.28,
        size.width * 0.86,
        size.height * 0.45,
      )
      ..lineTo(size.width * 0.86, size.height * 0.72)
      ..close();
    canvas.drawPath(building, palePaint);
    canvas.drawRect(
      Rect.fromLTWH(size.width * 0.69, size.height * 0.55, 6, 18),
      white,
    );
    canvas.drawRect(
      Rect.fromLTWH(size.width * 0.78, size.height * 0.55, 6, 18),
      white,
    );

    canvas.drawArc(
      Rect.fromLTWH(
        size.width * 0.10,
        size.height * 0.18,
        size.width * 0.62,
        size.height * 0.62,
      ),
      3.55,
      2.8,
      false,
      paint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * 0.09, size.height * 0.46, 17, 32),
        const Radius.circular(8),
      ),
      fill,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * 0.61, size.height * 0.46, 17, 32),
        const Radius.circular(8),
      ),
      fill,
    );

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * 0.27, size.height * 0.42, 43, 32),
        const Radius.circular(16),
      ),
      fill,
    );
    canvas.drawCircle(Offset(size.width * 0.40, size.height * 0.57), 4, white);
    canvas.drawCircle(Offset(size.width * 0.50, size.height * 0.57), 4, white);
    canvas.drawCircle(Offset(size.width * 0.60, size.height * 0.57), 4, white);
    canvas.drawLine(
      Offset(size.width * 0.69, size.height * 0.73),
      Offset(size.width * 0.74, size.height * 0.73),
      paint,
    );
    canvas.drawCircle(Offset(size.width * 0.78, size.height * 0.73), 5, fill);
  }

  @override
  bool shouldRepaint(covariant _HeroSupportPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.pale != pale;
}

class _QuickContactGrid extends StatelessWidget {
  const _QuickContactGrid({
    required this.onPhone,
    required this.onEmail,
    required this.onCenters,
  });

  final VoidCallback onPhone;
  final VoidCallback onEmail;
  final VoidCallback onCenters;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _QuickContactCard(
            icon: Icons.phone_rounded,
            title: 'Phone',
            value: _supportPhone,
            subtitle: 'Sun - Thu, 8:00 AM - 5:00 PM',
            onTap: onPhone,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _QuickContactCard(
            icon: Icons.mail_rounded,
            title: 'Email',
            value: _supportEmail,
            subtitle: 'We reply within 24 hours',
            onTap: onEmail,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _QuickContactCard(
            icon: Icons.apartment_rounded,
            title: 'Service Center',
            value: 'Find a nearby center',
            subtitle: 'Walk-in support available',
            onTap: onCenters,
            showArrow: true,
          ),
        ),
      ],
    );
  }
}

class _QuickContactCard extends StatelessWidget {
  const _QuickContactCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.subtitle,
    required this.onTap,
    this.showArrow = false,
  });

  final IconData icon;
  final String title;
  final String value;
  final String subtitle;
  final VoidCallback onTap;
  final bool showArrow;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      radius: 10,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
      child: Column(
        children: [
          SoftIconBadge(icon: icon, color: AppColors.primary, size: 52),
          const SizedBox(height: 10),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppSurface.ink(context),
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 11.4,
                    height: 1.18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (showArrow)
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.primary,
                  size: 16,
                ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppSurface.muted(context),
              fontSize: 10.5,
              height: 1.2,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({
    required this.nameController,
    required this.phoneController,
    required this.subjectController,
    required this.messageController,
    required this.submitting,
    required this.onSubmit,
    required this.onMessageChanged,
  });

  final TextEditingController nameController;
  final TextEditingController phoneController;
  final TextEditingController subjectController;
  final TextEditingController messageController;
  final bool submitting;
  final VoidCallback onSubmit;
  final VoidCallback onMessageChanged;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      radius: 12,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SoftIconBadge(
                icon: Icons.chat_bubble_rounded,
                color: AppColors.primary,
                size: 34,
              ),
              const SizedBox(width: 10),
              Text(
                'Send us a message',
                style: TextStyle(
                  color: AppSurface.ink(context),
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _FieldLabel('Full Name'),
          _ContactTextField(
            controller: nameController,
            hint: 'Enter your full name',
            icon: Icons.person_rounded,
            textInputAction: TextInputAction.next,
            validator: (value) {
              if ((value ?? '').trim().isEmpty) return 'Full name is required.';
              return null;
            },
          ),
          const SizedBox(height: 12),
          _FieldLabel('Phone Number'),
          _ContactTextField(
            controller: phoneController,
            hint: 'Enter your phone number',
            icon: Icons.phone_rounded,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            validator: (value) {
              if ((value ?? '').trim().isEmpty) {
                return 'Phone number is required.';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          _FieldLabel('Subject'),
          _ContactTextField(
            controller: subjectController,
            hint: 'Enter a subject',
            icon: Icons.sell_rounded,
            textInputAction: TextInputAction.next,
            validator: (value) {
              if ((value ?? '').trim().isEmpty) return 'Subject is required.';
              return null;
            },
          ),
          const SizedBox(height: 12),
          _FieldLabel('Message'),
          _ContactTextField(
            controller: messageController,
            hint: 'Type your message here...',
            icon: Icons.edit_rounded,
            maxLines: 4,
            maxLength: _messageMaxLength,
            onChanged: (_) => onMessageChanged(),
            validator: (value) {
              if ((value ?? '').trim().isEmpty) return 'Message is required.';
              return null;
            },
          ),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              '${messageController.text.length}/$_messageMaxLength',
              style: TextStyle(
                color: AppSurface.muted(context),
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 54,
            child: FilledButton.icon(
              onPressed: submitting ? null : onSubmit,
              icon: submitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send_rounded, size: 22),
              label: Text(submitting ? 'Sending...' : 'Send Message'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactTextField extends StatelessWidget {
  const _ContactTextField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.textInputAction,
    this.maxLines = 1,
    this.maxLength,
    this.onChanged,
    this.validator,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final int maxLines;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide(color: AppSurface.border(context), width: 1.2),
    );
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      maxLines: maxLines,
      maxLength: maxLength,
      onChanged: onChanged,
      validator: validator,
      style: TextStyle(
        color: AppSurface.ink(context),
        fontSize: 13.5,
        fontWeight: FontWeight.w700,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: AppSurface.muted(context),
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
        ),
        counterText: '',
        prefixIcon: Padding(
          padding: EdgeInsets.only(bottom: maxLines > 1 ? 52 : 0),
          child: Icon(icon, color: AppSurface.muted(context), size: 21),
        ),
        filled: true,
        fillColor: AppSurface.isDark(context)
            ? AppColors.darkElevated
            : const Color(0xFFFCFDFF),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        border: border,
        enabledBorder: border,
        focusedBorder: border.copyWith(
          borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
        ),
        errorBorder: border.copyWith(
          borderSide: const BorderSide(color: AppColors.danger, width: 1.2),
        ),
        focusedErrorBorder: border.copyWith(
          borderSide: const BorderSide(color: AppColors.danger, width: 1.4),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: TextStyle(
          color: AppSurface.ink(context),
          fontSize: 12.5,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _SupportInfoCard extends StatelessWidget {
  const _SupportInfoCard();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      radius: 12,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SoftIconBadge(
                icon: Icons.verified_user_rounded,
                color: AppColors.primary,
                size: 34,
              ),
              const SizedBox(width: 10),
              Text(
                'Support Information',
                style: TextStyle(
                  color: AppSurface.ink(context),
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _SupportInfoItem(
                  icon: Icons.schedule_rounded,
                  title: 'Office Hours',
                  body:
                      'Sunday - Thursday\n8:00 AM - 5:00 PM\n(excluding holidays)',
                  color: AppColors.primary,
                ),
              ),
              Container(
                width: 1,
                height: 90,
                margin: const EdgeInsets.symmetric(horizontal: 12),
                color: AppSurface.border(context),
              ),
              Expanded(
                child: _SupportInfoItem(
                  icon: Icons.chat_rounded,
                  title: 'Response Time',
                  body:
                      'We typically respond within\n24 hours during business days.',
                  color: AppColors.success,
                  highlight: '24 hours',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SupportInfoItem extends StatelessWidget {
  const _SupportInfoItem({
    required this.icon,
    required this.title,
    required this.body,
    required this.color,
    this.highlight,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color color;
  final String? highlight;

  @override
  Widget build(BuildContext context) {
    final parts = highlight == null ? null : body.split(highlight!);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SoftIconBadge(icon: icon, color: color, size: 42),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: AppSurface.ink(context),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              if (parts == null)
                Text(
                  body,
                  style: TextStyle(
                    color: AppSurface.muted(context),
                    fontSize: 11.8,
                    height: 1.35,
                    fontWeight: FontWeight.w600,
                  ),
                )
              else
                RichText(
                  text: TextSpan(
                    style: TextStyle(
                      color: AppSurface.muted(context),
                      fontSize: 11.8,
                      height: 1.35,
                      fontWeight: FontWeight.w600,
                    ),
                    children: [
                      TextSpan(text: parts.first),
                      TextSpan(
                        text: highlight,
                        style: const TextStyle(
                          color: AppColors.success,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      TextSpan(text: parts.length > 1 ? parts.last : ''),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ContactFooter extends StatelessWidget {
  const _ContactFooter({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: AppSurface.card(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppSurface.border(context)),
      ),
      child: Row(
        children: [
          SoftIconBadge(
            icon: Icons.lock_rounded,
            color: AppColors.primary,
            size: 42,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NQS',
                  style: TextStyle(
                    color: AppSurface.ink(context),
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  'National Queue System',
                  style: TextStyle(
                    color: AppSurface.muted(context),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(width: 1, height: 42, color: AppSurface.border(context)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Your ID. Our Priority.',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  'Fast. Secure. Reliable.',
                  style: TextStyle(
                    color: AppSurface.muted(context),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
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
