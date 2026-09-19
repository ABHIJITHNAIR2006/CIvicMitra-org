import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle benign HMR websocket disconnection when running in sandboxed dev environments
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = event.reason?.message || String(event.reason || '');
  if (reasonStr.includes('WebSocket') || reasonStr.includes('websocket')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
