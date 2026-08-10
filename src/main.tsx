import './polyfill';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Root element '#root' not found in HTML!");
  }
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error: any) {
  console.error("CRITICAL APP INITIALIZATION ERROR:", error);
  // Display detailed onscreen overlay error in the sandbox so developers/users can see exactly what's failing.
  const errorContainer = document.createElement('div');
  errorContainer.style.background = '#fef2f2';
  errorContainer.style.color = '#991b1b';
  errorContainer.style.border = '1px solid #fca5a5';
  errorContainer.style.padding = '16px';
  errorContainer.style.margin = '20px';
  errorContainer.style.borderRadius = '8px';
  errorContainer.style.fontFamily = 'monospace';
  errorContainer.style.fontSize = '14px';
  errorContainer.style.lineHeight = '1.5';
  errorContainer.style.whiteSpace = 'pre-wrap';
  errorContainer.innerHTML = `<strong>[Do Bill POS] App Initialization Failed</strong>\n\n` +
    `<strong>Error:</strong> ${error?.message || error}\n\n` +
    `<strong>Stack Trace:</strong>\n${error?.stack || 'No stack trace available.'}`;
  document.body.appendChild(errorContainer);
}
