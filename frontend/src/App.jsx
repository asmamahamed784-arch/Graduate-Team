// src/App.jsx
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './i18n';

// Shared Providers
import ToastProvider from './components/ToastProvider';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';

// Master Dynamic Role-Based App Routing
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <Router>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </Router>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
