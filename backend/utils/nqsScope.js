export const NATIONAL_ID_SERVICE_NAME = 'National ID Registration';
export const LOST_NATIONAL_ID_SERVICE_NAME = 'Replace Lost National ID';
export const UPDATE_NATIONAL_ID_SERVICE_NAME = 'Update National ID Information';
export const NATIONAL_ID_CATEGORY = 'National ID';

export const NATIONAL_ID_CORE_SERVICES = [
  {
    name: NATIONAL_ID_SERVICE_NAME,
    description: 'Apply for a new National ID card and manage your appointment at a Banaadir service center.',
    category: NATIONAL_ID_CATEGORY,
    duration: 15,
    priority: 'High',
    requirements: ['Birth Certificate', 'Existing Identification (if available)', 'Passport-size Photo']
  },
  {
    name: LOST_NATIONAL_ID_SERVICE_NAME,
    description: 'Use this option if your National ID card is lost and you need a replacement.',
    category: NATIONAL_ID_CATEGORY,
    duration: 20,
    priority: 'High',
    requirements: ['National ID Number if known', 'Police report number if available', 'Passport-size Photo']
  },
  {
    name: UPDATE_NATIONAL_ID_SERVICE_NAME,
    description: 'Use this option if you need to correct or update your National ID information.',
    category: NATIONAL_ID_CATEGORY,
    duration: 20,
    priority: 'Medium',
    requirements: ['National ID Number', 'Current information', 'Corrected information', 'Supporting notes']
  }
];

export const NATIONAL_ID_SERVICE_NAMES = NATIONAL_ID_CORE_SERVICES.map((service) => service.name);

export const BANAADIR_CENTER_NAMES = [
  'Banaadir National ID Center',
  'Hodan National ID Center',
  'Hamar Weyne National ID Center',
  'Hamar Jajab National ID Center',
  'Wadajir National ID Center',
  'Dharkenley National ID Center',
  'Yaqshiid National ID Center',
  'Kaaraan National ID Center',
  'Waberi National ID Center',
  'Shangaani National ID Center',
  'Shibis National ID Center',
  'Boondheere National ID Center',
  'Abdulaziz National ID Center',
  'Dayniile National ID Center',
  'Kaxda National ID Center',
  'Heliwaa National ID Center',
  'Hawl-Wadaag National ID Center',
  'Wardhiigley National ID Center',
  'Howlwadaag National ID Center',
  'Xamar Weyne National ID Center',
  'Xamar Jajab National ID Center',
  'Waaberi National ID Center',
  'Garasbaaley National ID Center',
  // Accepted legacy spellings so existing databases keep working until reseeded.
  'Karaan National ID Center',
  'Yaqshid National ID Center'
];

export const isNationalIdService = (service) => {
  if (!service) return false;
  return NATIONAL_ID_SERVICE_NAMES.includes(service.name) && service.category === NATIONAL_ID_CATEGORY;
};

export const isLostNationalIdReplacementService = (service) => {
  if (!service) return false;
  return service.name === LOST_NATIONAL_ID_SERVICE_NAME && service.category === NATIONAL_ID_CATEGORY;
};

export const isUpdateNationalIdInformationService = (service) => {
  if (!service) return false;
  return service.name === UPDATE_NATIONAL_ID_SERVICE_NAME && service.category === NATIONAL_ID_CATEGORY;
};

export const isBanaadirNationalIdCenter = (center) => {
  if (!center) return false;
  return center.city === 'Banaadir' && BANAADIR_CENTER_NAMES.includes(center.name);
};
