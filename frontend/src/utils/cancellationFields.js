/** Incorrect-field options for New National ID / general appointment cancellation. */
export const INCORRECT_FIELD_OPTIONS = [
  'Full Name',
  "Mother's Name",
  'Date of Birth',
  'Age',
  'Gender',
  'Marital Status',
  'Nearest Landmark',
  'Full Address',
];

/** Incorrect-field options for Replace Lost National ID cancellation only. */
export const LOST_ID_INCORRECT_FIELD_OPTIONS = [
  'Date Lost',
  'Place Lost',
  'Reason',
  'Police Report Number',
  'Police Report Document',
  'Selected Center',
];

export const isLostReplacementRequest = (ticket = {}) => {
  const type = String(ticket.requestType || ticket.type || '').toLowerCase().replace(/[\s-]+/g, '_');
  return type === 'lost_replacement' || type === 'replace_lost_id';
};

export const getIncorrectFieldOptionsForTicket = (ticket = {}) => (
  isLostReplacementRequest(ticket) ? LOST_ID_INCORRECT_FIELD_OPTIONS : INCORRECT_FIELD_OPTIONS
);

/** Maps staff incorrect-field labels → Replace Lost ID form keys. */
const LOST_ID_LABEL_TO_FORM_FIELD = {
  'phone number': 'phone',
  phone: 'phone',
  'date lost': 'dateLost',
  'place lost': 'placeLost',
  reason: 'reason',
  'police report number': 'policeReportNumber',
  'police report document': 'policeReportDocument',
  notes: 'notes',
  'additional notes': 'notes',
  'district where you live': 'district',
  district: 'district',
  'selected center': 'centerId',
  center: 'centerId',
  'appointment date': 'date',
  'appointment time': 'timeSlot',
};

/**
 * Form fields the citizen may edit when resubmitting a cancelled Lost ID request.
 * Only fields staff marked as incorrect are unlocked.
 */
export const getEditableLostIdFormFields = (ticket = {}) => {
  const embedded =
    ticket.replacementDetails?.cancellationDetails ||
    ticket.registrationDetails?.cancellationDetails ||
    {};
  const reasons = [
    ...(Array.isArray(ticket.cancellationReasons) ? ticket.cancellationReasons : []),
    ...(Array.isArray(embedded.cancellationReasons) ? embedded.cancellationReasons : []),
    ...(Array.isArray(embedded.reasons) ? embedded.reasons : []),
    ticket.cancellationReason,
    embedded.cancellationReason,
    embedded.summary,
  ]
    .flatMap((value) => String(value || '').split(/[,;|]/))
    .map((part) => part.trim())
    .filter(Boolean);

  const fields = new Set();
  reasons.forEach((reason) => {
    const key = reason.toLowerCase();
    const mapped = LOST_ID_LABEL_TO_FORM_FIELD[key];
    if (mapped) {
      fields.add(mapped);
      return;
    }
    Object.entries(LOST_ID_LABEL_TO_FORM_FIELD).forEach(([label, field]) => {
      if (key.includes(label)) fields.add(field);
    });
  });

  // If staff reasons could not be mapped, keep all correctable Lost ID fields editable.
  if (!fields.size) {
    return new Set(Object.values(LOST_ID_LABEL_TO_FORM_FIELD));
  }

  return fields;
};

const displayValue = (value, fallback = '--') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const formatLostDate = (value) => {
  if (!value) return '--';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Citizen-submitted Lost ID form values shown in the cancel modal. */
export const getLostIdSubmittedDetails = (ticket = {}) => {
  const details = ticket.replacementDetails || {};
  const centerName = typeof ticket.center === 'object'
    ? (ticket.center?.name || '--')
    : (ticket.centerName || ticket.center || details.selectedCenter || '--');

  return [
    ['National ID Number', displayValue(details.nationalIdNumber, 'Not provided')],
    ['Full Name', displayValue(details.fullName || ticket.citizenName || ticket.citizen?.name)],
    ['Phone Number', displayValue(details.phone || ticket.citizen?.phone)],
    ['Date Lost', formatLostDate(details.dateLost)],
    ['Place Lost', displayValue(details.placeLost)],
    ['Reason', displayValue(details.reason)],
    ['Police Report Number', displayValue(details.policeReportNumber, 'Not provided')],
    ['Police Report Document', displayValue(details.policeReportDocument, 'Not uploaded')],
    ['Citizen Notes', displayValue(details.additionalNotes || details.notes, 'None')],
    ['District', displayValue(details.district || ticket.district)],
    ['Selected Center', displayValue(centerName)],
    ['Appointment Date', formatLostDate(ticket.date || ticket.appointmentDate)],
    ['Appointment Time', displayValue(ticket.timeSlot || ticket.appointmentTime, 'Not scheduled')],
  ];
};
