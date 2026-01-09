import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';


// Importer la configuration Axios (intercepteurs pour les tokens)
import './services/axiosConfig';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
