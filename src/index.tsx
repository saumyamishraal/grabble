import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles.scss';
import App from './App';
import reportWebVitals from './reportWebVitals';

console.log('🚀 index.tsx loaded, attempting to render App...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

console.log('✅ Root element found, creating root...');

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('✅ Root created, rendering App...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('✅ App rendered successfully!');
} catch (error) {
  console.error('❌ Error rendering App:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: monospace;">
      <h1>Error Loading App</h1>
      <pre>${error instanceof Error ? error.stack : String(error)}</pre>
    </div>
  `;
  throw error;
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
