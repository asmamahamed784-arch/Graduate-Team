// src/App.jsx
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './i18n';

// Shared Providers
import ToastProvider from './components/ToastProvider';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { QueueProvider } from './context/QueueContext';

// Master Dynamic Role-Based App Routing
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <NotificationProvider>
            <QueueProvider>
              <ToastProvider>
                <Router>
                  <AppRoutes />
                </Router>
              </ToastProvider>
            </QueueProvider>
          </NotificationProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
