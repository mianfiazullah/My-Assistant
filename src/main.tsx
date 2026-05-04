import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress MetaMask/Web3 extension errors that occur in the iframe sandbox
const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args.join(' ');
  if (
    typeof msg === 'string' && 
    (msg.includes('Cannot set property fetch of #<Window> which has only a getter') ||
    msg.includes('Failed to connect to MetaMask') ||
    msg.includes('MetaMask'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (
    msg.includes('Cannot set property fetch of #<Window> which has only a getter') ||
    msg.includes('Failed to connect to MetaMask') ||
    msg.includes('MetaMask')
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason) || '';
  if (
    msg.includes('Cannot set property fetch of #<Window> which has only a getter') ||
    msg.includes('Failed to connect to MetaMask') ||
    msg.includes('MetaMask')
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

// Remove any legacy error banners left over from cached index.html
document.querySelectorAll('div').forEach(div => {
  if (div.style.zIndex === '999999' && (div.style.backgroundColor === 'rgba(255, 0, 0, 0.8)' || div.textContent?.includes('Error: undefined at undefined:undefined'))) {
    div.remove();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
