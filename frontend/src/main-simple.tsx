import React from 'react'
import { createRoot } from 'react-dom/client'

console.log('Simple main loading...');

const SimpleApp = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>React is working!</h1>
      <p>If you see this message, the React application loaded successfully.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    createRoot(rootElement).render(<SimpleApp />);
    console.log('Simple app rendered');
  } catch (err) {
    console.error('Simple app error:', err);
    rootElement.innerHTML = '<h1>Error loading React</h1><p>' + err + '</p>';
  }
} else {
  console.error('No root element');
}