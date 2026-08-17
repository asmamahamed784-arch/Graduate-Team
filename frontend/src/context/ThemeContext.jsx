// src/context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {}
});

const readStoredTheme = () => {
  try {
    return localStorage.getItem('nqs-theme') || localStorage.getItem('theme');
  } catch {
    return null;
  }
};

const writeStoredTheme = (theme) => {
  try {
    localStorage.setItem('nqs-theme', theme);
    localStorage.setItem('theme', theme);
  } catch {
    // Keep the in-memory theme if browser storage is unavailable.
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = readStoredTheme();
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';

    root.classList.toggle('dark', isDark);
    root.classList.toggle('nqs-theme-dark', isDark);
    root.classList.toggle('nqs-theme-light', !isDark);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    writeStoredTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
