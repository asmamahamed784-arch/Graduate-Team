import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/**
 * Custom hook to manage active dark/light visual theme preferences.
 * Integrates with ThemeContext and supplies state checks.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  const { theme, toggleTheme } = context;
  const isDark = theme === 'dark';

  return {
    theme,
    toggleTheme,
    isDark,
    isLight: !isDark
  };
};
