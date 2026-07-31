export const NEW_ID_SERVICE_NAME = 'National ID Registration';
export const UPDATE_INFO_SERVICE_NAME = 'Update National ID Information';
export const LOST_ID_SERVICE_NAME = 'Replace Lost National ID';

export const timeSlots = [
  '08:00 AM',
  '08:30 AM',
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '01:00 PM',
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM'
];

export const updateFieldOptions = ['Name', "Mother's Name", 'Date of Birth', 'Phone Number', 'Address', 'Marital Status', 'Other'];

export const todayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isBeforeToday = (value) => Boolean(value && value < todayKey());

export const slotToMinutes = (slot) => {
  const raw = String(slot || '').trim();
  if (!raw) return null;

  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return (hour * 60) + minute;
  }

  const [hour, minute = '0'] = raw.split(':');
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  if (Number.isNaN(hourNumber) || Number.isNaN(minuteNumber)) return null;
  return (hourNumber * 60) + minuteNumber;
};

export const currentTimeMinutes = () => {
  const now = new Date();
  return (now.getHours() * 60) + now.getMinutes();
};

export const isPastTimeSlot = (dateValue, slot) => {
  if (!dateValue || dateValue !== todayKey()) return false;
  const minutes = slotToMinutes(slot);
  return minutes !== null && minutes <= currentTimeMinutes();
};

export const maxDateKey = (days = 365) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDate = (value) => {
  if (!value) return 'Not selected';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatSomaliPhone = (value) => {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('25261')) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('061')) return `+252${digits.slice(1, 10)}`;
  if (digits.startsWith('61')) return `+252${digits.slice(0, 9)}`;
  return `+25261${digits.slice(0, 7)}`;
};

export const isValidSomaliPhone = (value) => /^\+25261\d{7}$/.test(formatSomaliPhone(value));

export const isFridayDate = (value) => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getDay() === 5;
};

export const fridayClosedMessage = 'Friday is a non-working day. Please choose another appointment date.';

export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return '';
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return '';
  const today = new Date();
  if (dob > today) return '';
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

export const getDistrict = (center) => {
  if (!center) return 'Banaadir';
  if (center.district) return center.district;
  return center.name?.replace(/\s+National ID Center$/i, '').trim() || center.city || 'Banaadir';
};

export const findService = (services, serviceName) => (
  services.find((service) => service.name === serviceName)
);

export const activeCenters = (centers) => (
  centers.filter((center) => {
    const status = String(center.status || 'Active').trim().toLowerCase();
    return (!status || ['active', 'open'].includes(status)) && center.schedule?.isActive !== false;
  })
);

export const pageShellClass = 'min-h-screen bg-[#F5F8FC] px-3 py-10 pt-28 text-slate-900 sm:px-5 lg:px-6';
export const panelClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
export const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0B3A75] focus:ring-2 focus:ring-blue-100';
export const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500';
