const splitReasonValues = (value) => String(value || '')
  .split(/[,;|]/)
  .map((part) => part.trim())
  .filter(Boolean);

const embeddedCancellationDetails = (item = {}) => (
  item.cancellationDetails ||
  item.registrationDetails?.cancellationDetails ||
  item.replacementDetails?.cancellationDetails ||
  item.updateDetails?.cancellationDetails ||
  {}
);

const normalizeReasonValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(
      value.reasonName ||
      value.reason ||
      value.label ||
      value.name ||
      value.value ||
      ''
    ).trim();
  }
  return String(value).trim();
};

const asReasonArray = (value) => {
  if (Array.isArray(value)) return value.map(normalizeReasonValue).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(normalizeReasonValue).filter(Boolean);
      if (parsed && typeof parsed === 'object') {
        return asReasonArray(parsed.cancellationReasons || parsed.reasons || parsed.reason || parsed.summary);
      }
    } catch {
      return splitReasonValues(value);
    }
  }
  if (value && typeof value === 'object') {
    return asReasonArray(value.cancellationReasons || value.reasons || value.reason || value.summary);
  }
  return [];
};

export const getCancellationReasonList = (item = {}) => {
  const embedded = embeddedCancellationDetails(item);
  const directReasons = asReasonArray(item.cancellationReasons);
  const embeddedReasons = asReasonArray(embedded.cancellationReasons).length
    ? asReasonArray(embedded.cancellationReasons)
    : asReasonArray(embedded.reasons);
  const reasons = directReasons.length ? directReasons : embeddedReasons;
  const additional = String(
    item.additionalCancellationReason ||
    item.additionalReason ||
    embedded.additionalCancellationReason ||
    embedded.additionalReason ||
    ''
  ).trim();
  const filtered = reasons
    .filter((reason) => reason && String(reason).trim().toLowerCase() !== 'other')
    .flatMap(splitReasonValues);

  if (additional && (reasons.some((reason) => String(reason).trim().toLowerCase() === 'other') || !filtered.length)) {
    filtered.push(...splitReasonValues(additional));
  }

  const unique = [...new Set(filtered)];
  if (unique.length) return unique;

  const summary = item.cancellationReason ||
    item.rejectionReason ||
    embedded.cancellationReason ||
    embedded.summary ||
    '';
  return splitReasonValues(summary);
};

export const getCancellationFeedbackText = (item = {}, fallback = 'Please correct your information and resubmit.') => {
  const embedded = embeddedCancellationDetails(item);
  const reasons = getCancellationReasonList(item);
  const reasonText = reasons.length ? reasons.join(', ') : '';
  const note = String(
    item.cancellationNotes ||
    item.additionalNotes ||
    item.note ||
    embedded.cancellationNotes ||
    embedded.additionalNotes ||
    ''
  ).trim();
  const parts = [];

  if (reasonText) parts.push(`Reason: ${reasonText}`);
  if (note) parts.push(`Admin note: ${note}`);

  return parts.length ? parts.join(' ') : fallback;
};

export const getNotificationDisplayMessage = (notification = {}) => {
  const message = notification.desc || notification.message || '';
  const feedback = getCancellationFeedbackText(notification, '');
  const reasons = getCancellationReasonList(notification);
  const lowerMessage = message.toLowerCase();

  if (!feedback) return message;
  if (reasons.some((reason) => lowerMessage.includes(String(reason).toLowerCase()))) return message;
  if (message && message.toLowerCase().includes(feedback.toLowerCase())) return message;
  return message ? `${message}\n${feedback}` : feedback;
};
