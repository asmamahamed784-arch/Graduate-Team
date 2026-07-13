// src/context/LanguageContext.jsx
import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {}
});

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();

  const setLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
    
    // Immediate alignment change for layout directions (LTR/RTL)
    if (lng === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = lng;
      document.documentElement.classList.remove('rtl');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('i18nextLng') || 'en';
    if (i18n.language !== saved) {
      i18n.changeLanguage(saved);
    }
  }, [i18n]);

  useEffect(() => {
    const currentLang = i18n.language || 'en';
    if (currentLang === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = currentLang;
      document.documentElement.classList.remove('rtl');
    }
  }, [i18n.language]);

  return (
    <LanguageContext.Provider value={{ language: i18n.language || 'en', setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
