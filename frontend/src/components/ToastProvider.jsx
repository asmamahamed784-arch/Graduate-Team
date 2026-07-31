import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTheme } from '../hooks';

const ToastProvider = ({ children }) => {
  const { theme } = useTheme();

  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
        theme={theme}
        toastClassName="nqs-toast"
      />
    </>
  );
};

export default ToastProvider;
