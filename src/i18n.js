import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      language: 'Language',
      dark_mode: 'Dark Mode',
      light_mode: 'Light Mode',
      welcome: 'Welcome to NQS',
      services: 'Services',
      centers: 'Centers',
      faq: 'Frequently Asked Questions',
      contact: 'Contact Us',
      dashboard: 'Dashboard',
      reports: 'Reports',
      settings: 'Settings',
      profile: 'Profile',
      notification: 'Notification',
      logout: 'Log out',
      home: 'Home',
      book_appointment: 'Book Appointment',
      track_queue: 'Check Queue Status',
      active_queues: 'Active Queues',
      completed_services: 'Completed Services',
      risk_low: 'Low',
      risk_medium: 'Medium',
      risk_high: 'High'
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
