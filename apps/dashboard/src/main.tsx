import React from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';

// In production (e.g. Render / Cloud), point axios to VITE_GATEWAY_URL if defined
if (import.meta.env.VITE_GATEWAY_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_GATEWAY_URL;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
