import { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';

/**
 * Custom hook to control application translation state and language configuration.
 * Consumes global LanguageContext and handles RTL direction layout properties.
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  const { language, setLanguage } = context;

  const changeLanguage = (lng) => {
    setLanguage(lng);
  };

  const isRTL = language === 'ar';

  return {
    language,
    setLanguage,
    changeLanguage,
    isRTL,
    dir: isRTL ? 'rtl' : 'ltr'
  };
};
