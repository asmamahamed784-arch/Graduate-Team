import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';

/// New National ID mockup chrome (navy + white).
class BookingMockStyle {
  const BookingMockStyle._();

  static const Color accent = AppColors.navy;
  static const Color navy = AppColors.navy;
  static const Color ink = Color(0xFF111827);
  static const Color placeholder = Color(0xFF9CA3AF);
  static const Color line = Color(0xFFE5E7EB);
  static const Color stepIdle = Color(0xFFD1D5DB);

  static const TextStyle labelStyle = TextStyle(
    color: ink,
    fontWeight: FontWeight.w700,
    fontSize: 14,
    height: 1.2,
  );

  static const TextStyle hintStyle = TextStyle(
    color: placeholder,
    fontWeight: FontWeight.w500,
    fontSize: 15,
  );

  static InputDecoration underline({
    String? hint,
    Widget? prefix,
    Widget? suffix,
    String? errorText,
  }) {
    return InputDecoration(
      hintText: hint,
      hintStyle: hintStyle,
      prefixIcon: prefix,
      prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
      suffixIcon: suffix,
      suffixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 28),
      errorText: errorText,
      isDense: true,
      contentPadding: const EdgeInsets.only(top: 4, bottom: 10),
      border: const UnderlineInputBorder(
        borderSide: BorderSide(color: accent, width: 1.35),
      ),
      enabledBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: accent, width: 1.35),
      ),
      focusedBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: accent, width: 1.8),
      ),
      errorBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: AppColors.danger),
      ),
      focusedErrorBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: AppColors.danger, width: 1.5),
      ),
    );
  }

  static InputDecoration boxed({
    String? hint,
    Widget? suffix,
    Widget? prefix,
    String? errorText,
  }) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: line, width: 1.2),
    );
    return InputDecoration(
      hintText: hint,
      hintStyle: hintStyle,
      prefixIcon: prefix,
      suffixIcon: suffix,
      errorText: errorText,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: accent, width: 1.5),
      ),
    );
  }
}

/// Light-blue tip banner used on Lost ID mockups.
class BookingInfoBanner extends StatelessWidget {
  const BookingInfoBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
            ),
            child: const Text(
              'i',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.navy,
                fontWeight: FontWeight.w600,
                fontSize: 13,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Boxed field with leading icon (Lost ID mockup style).
class BookingIconTextField extends StatelessWidget {
  const BookingIconTextField({
    super.key,
    required this.label,
    required this.controller,
    required this.icon,
    this.hint,
    this.validator,
    this.keyboardType,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.maxLines = 1,
    this.readOnly = false,
    this.onTap,
    this.suffix,
    this.optional = false,
    this.maxLength,
  });

  final String label;
  final TextEditingController controller;
  final IconData icon;
  final String? hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final int maxLines;
  final bool readOnly;
  final VoidCallback? onTap;
  final Widget? suffix;
  final bool optional;
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    return BookingLabeledField(
      label: optional ? '$label (Optional)' : label,
      child: TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        textCapitalization: textCapitalization,
        maxLines: maxLines,
        maxLength: maxLength,
        readOnly: readOnly,
        onTap: onTap,
        style: const TextStyle(
          color: BookingMockStyle.ink,
          fontWeight: FontWeight.w600,
          fontSize: 15,
        ),
        decoration: BookingMockStyle.boxed(
          hint: hint,
          prefix: Icon(icon, color: BookingMockStyle.accent, size: 22),
          suffix: suffix,
        ).copyWith(counterText: maxLength == null ? null : ''),
      ),
    );
  }
}

class BookingUploadZone extends StatelessWidget {
  const BookingUploadZone({super.key, required this.onTap, this.fileName});

  final VoidCallback onTap;
  final String? fileName;

  @override
  Widget build(BuildContext context) {
    final hasFile = fileName != null && fileName!.trim().isNotEmpty;
    return BookingLabeledField(
      label: 'Upload Police Report (Optional)',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: CustomPaint(
          painter: _DashedRRectPainter(
            color: hasFile ? AppColors.primary : BookingMockStyle.line,
          ),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
            child: Column(
              children: [
                Icon(
                  hasFile
                      ? Icons.insert_drive_file_outlined
                      : Icons.cloud_upload_outlined,
                  color: BookingMockStyle.accent,
                  size: 28,
                ),
                const SizedBox(height: 8),
                Text(
                  hasFile ? fileName! : 'Choose file',
                  style: const TextStyle(
                    color: BookingMockStyle.accent,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  hasFile
                      ? 'Tap to change or clear'
                      : 'or drag document PDF, JPG or PNG (Max 10MB)',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: BookingMockStyle.placeholder,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedRRectPainter extends CustomPainter {
  _DashedRRectPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke;
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(14),
    );
    final path = Path()..addRRect(rrect);
    const dash = 6.0;
    const gap = 4.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dash;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          paint,
        );
        distance = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRectPainter oldDelegate) =>
      oldDelegate.color != color;
}

class BookingLabeledField extends StatelessWidget {
  const BookingLabeledField({
    super.key,
    required this.label,
    required this.child,
    this.requiredMark = false,
  });

  final String label;
  final Widget child;
  final bool requiredMark;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: BookingMockStyle.labelStyle,
            children: [
              if (requiredMark)
                const TextSpan(
                  text: ' *',
                  style: TextStyle(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w800,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

class BookingTextField extends StatelessWidget {
  const BookingTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.validator,
    this.keyboardType,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.maxLines = 1,
    this.prefixText,
    this.prefix,
    this.suffix,
    this.readOnly = false,
    this.onTap,
    this.requiredMark = false,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final int maxLines;
  final String? prefixText;
  final Widget? prefix;
  final Widget? suffix;
  final bool readOnly;
  final VoidCallback? onTap;
  final bool requiredMark;

  @override
  Widget build(BuildContext context) {
    return BookingLabeledField(
      label: label,
      requiredMark: requiredMark,
      child: TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        textCapitalization: textCapitalization,
        maxLines: maxLines,
        readOnly: readOnly,
        onTap: onTap,
        style: const TextStyle(
          color: BookingMockStyle.ink,
          fontWeight: FontWeight.w600,
          fontSize: 15,
        ),
        decoration:
            BookingMockStyle.underline(
              hint: hint,
              prefix: prefix,
              suffix: suffix,
            ).copyWith(
              prefixText: prefixText,
              prefixStyle: const TextStyle(
                color: BookingMockStyle.accent,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
      ),
    );
  }
}

class BookingDropdownField<T> extends StatelessWidget {
  const BookingDropdownField({
    super.key,
    required this.label,
    required this.items,
    required this.onChanged,
    this.value,
    this.hint,
    this.validator,
    this.requiredMark = false,
    this.boxed = false,
    this.valueColor,
    this.suffix,
  });

  final String label;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final String? hint;
  final String? Function(T?)? validator;
  final bool requiredMark;
  final bool boxed;
  final Color? valueColor;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return BookingLabeledField(
      label: label,
      requiredMark: requiredMark,
      child: DropdownButtonFormField<T>(
        initialValue: value,
        items: items,
        onChanged: onChanged,
        validator: validator,
        isExpanded: true,
        icon:
            suffix ??
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: BookingMockStyle.accent,
            ),
        style: TextStyle(
          color: valueColor ?? BookingMockStyle.ink,
          fontWeight: FontWeight.w600,
          fontSize: 15,
        ),
        decoration: boxed
            ? BookingMockStyle.boxed(hint: hint)
            : BookingMockStyle.underline(hint: hint),
        hint: Text(hint ?? 'Select', style: BookingMockStyle.hintStyle),
      ),
    );
  }
}

/// Mockup stepper:
/// - completed = white + navy ring + navy number
/// - active = navy fill + white number
/// - future = grey ring + grey number
class BookingCircleStepper extends StatelessWidget {
  const BookingCircleStepper({
    super.key,
    required this.current,
    required this.total,
    this.labels,
  });

  final int current;
  final int total;
  final List<String>? labels;

  @override
  Widget build(BuildContext context) {
    final hasLabels = labels != null && labels!.length == total;
    return Column(
      children: [
        SizedBox(
          height: 38,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Positioned(
                left: hasLabels ? 28 : 17,
                right: hasLabels ? 28 : 17,
                child: Row(
                  children: List.generate(total - 1, (index) {
                    final reached = index < current;
                    return Expanded(
                      child: Container(
                        height: 2,
                        color: reached
                            ? BookingMockStyle.accent
                            : BookingMockStyle.stepIdle,
                      ),
                    );
                  }),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(total, (index) {
                  final done = index < current;
                  final active = index == current;
                  return Container(
                    width: 34,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: active ? BookingMockStyle.accent : Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: done || active
                            ? BookingMockStyle.accent
                            : BookingMockStyle.stepIdle,
                        width: 2,
                      ),
                    ),
                    child: Text(
                      '${index + 1}',
                      style: TextStyle(
                        color: active
                            ? Colors.white
                            : done
                            ? BookingMockStyle.accent
                            : BookingMockStyle.stepIdle,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  );
                }),
              ),
            ],
          ),
        ),
        if (hasLabels) ...[
          const SizedBox(height: 8),
          Row(
            children: List.generate(total, (index) {
              final active = index == current;
              final done = index < current;
              return Expanded(
                child: Text(
                  labels![index],
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: active || done
                        ? BookingMockStyle.accent
                        : BookingMockStyle.stepIdle,
                    fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    fontSize: 10.5,
                    height: 1.15,
                  ),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}
