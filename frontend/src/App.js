import React, { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import Parcelles from './components/Parcelles';
import Arbres from './components/Arbres';
import Carte from './components/Carte';
import Interventions from './components/Interventions';
import Recoltes from './components/Recoltes';
import Clients from './components/Clients';
import Ventes from './components/Ventes';
import Statistiques from './components/Statistiques';
import Previsions from './components/Previsions';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'parcelles':
        return <Parcelles />;
      case 'arbres':
        return <Arbres />;
      case 'carte':
        return <Carte />;
      case 'interventions':
        return <Interventions />;
      case 'recoltes':
        return <Recoltes />;
      case 'clients':
        return <Clients />;
      case 'ventes':
        return <Ventes />;
      case 'statistiques':
        return <Statistiques />;
      case 'previsions':
        return <Previsions />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>🍄 Gestion de Truffière</h1>
        </div>
        <div className="navbar-menu">
          <button 
            className={currentPage === 'dashboard' ? 'active' : ''} 
            onClick={() => setCurrentPage('dashboard')}
          >
            📊 Tableau de bord
          </button>
          <button 
            className={currentPage === 'carte' ? 'active' : ''} 
            onClick={() => setCurrentPage('carte')}
          >
            🗺️ Carte
          </button>
          <button 
            className={currentPage === 'parcelles' ? 'active' : ''} 
            onClick={() => setCurrentPage('parcelles')}
          >
            📋 Parcelles
          </button>
          <button 
            className={currentPage === 'arbres' ? 'active' : ''} 
            onClick={() => setCurrentPage('arbres')}
          >
            🌳 Arbres
          </button>
          <button 
            className={currentPage === 'interventions' ? 'active' : ''} 
            onClick={() => setCurrentPage('interventions')}
          >
            🛠️ Interventions
          </button>
          <button 
            className={currentPage === 'recoltes' ? 'active' : ''} 
            onClick={() => setCurrentPage('recoltes')}
          >
            🍄 Récoltes
          </button>
          <button 
            className={currentPage === 'clients' ? 'active' : ''} 
            onClick={() => setCurrentPage('clients')}
          >
            👥 Clients
          </button>
          <button 
            className={currentPage === 'ventes' ? 'active' : ''} 
            onClick={() => setCurrentPage('ventes')}
          >
            💰 Ventes
          </button>
          <button 
            className={currentPage === 'statistiques' ? 'active' : ''} 
            onClick={() => setCurrentPage('statistiques')}
          >
            📈 Statistiques
          </button>
          <button 
            className={currentPage === 'previsions' ? 'active' : ''} 
            onClick={() => setCurrentPage('previsions')}
          >
            🔮 Prévisions
          </button>
        </div>
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;