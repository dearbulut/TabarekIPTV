import React from 'react';
import ReactDOM from 'react-dom/client';
import { init } from '@noriginmedia/norigin-spatial-navigation';
import { IntegratedPlayer } from './components/IntegratedPlayer';
import './styles/global.scss';

// Initialize spatial navigation for TV remote control
init({
  debug: false,
  visualDebug: false,
  throttle: 100,
});

// Get content parameters from URL
const params = new URLSearchParams(window.location.search);
const contentType = params.get('type') as 'live' | 'movie' | 'series' || 'live';
const contentId = params.get('id') || '';

// Handle back button for TV
const handleBack = () => {
  if (window.tizen) {
    window.tizen.application.getCurrentApplication().exit();
  } else {
    window.history.back();
  }
};

// Create root element
const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

// Render application
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <IntegratedPlayer
      contentType={contentType}
      contentId={contentId}
      onBack={handleBack}
    />
  </React.StrictMode>
);