import React from 'react';
import ReactDOM from 'react-dom/client';
import Game from './Game';
import ErrorBoundary from './ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary><Game /></ErrorBoundary>
  </React.StrictMode>
);
