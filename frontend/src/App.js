// ============================================================
// App.js - Application principale avec authentification
// ============================================================

import React, { useState } from 'react';
import './App.css';
import './Login.css';
import './UserManagement.css';

// Context d'authentification
import { AuthProvider, useAuth } from './context/AuthContext';

// Composants
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Parcelles from './components/Parcelles';
// Import de la nouvelle structure de la feature arbres
import ArbresPage from './features/arbres/pages/ArbresPage';
import Carte from './components/Carte';
import Interventions from './components/Interventions';
import RecoltesPage from './features/recoltes/pages/RecoltesPage';
import Commercial from './components/Commercial';
// import AchatsComponent from '@/components/AchatsComponent.vue';
// routes.push({
  // path: '/achats',
  // component: AchatsComponent
// });
import Statistiques from './components/Statistiques';
import Previsions from './components/Previsions';
import Parametres from './components/Parametres';
import Historique from './components/Historique';
import UserManagement from './components/UserManagement';
import ChangePassword from './components/ChangePassword';
import GlobalSearch from './components/GlobalSearch';

// ============================================================
// Composant UserMenu - Menu utilisateur dans la navbar
// ============================================================
const UserMenu = ({ onShowUserManagement, onShowChangePassword }) => {
  const { user, logout, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const getInitials = (nom, prenom) => {
    const n = nom?.[0] || '';
    const p = prenom?.[0] || '';
    return (n + p).toUpperCase() || '?';
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'user': return 'Utilisateur';
      case 'readonly': return 'Lecture seule';
      default: return role;
    }
  };

  return (
    <div className="user-menu">
      <button 
        className="user-menu-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="user-avatar">
          {getInitials(user?.nom, user?.prenom)}
        </div>
        <div className="user-info">
          <span className="user-name">{user?.nom || 'Utilisateur'}</span>
          <span className="user-role">{getRoleLabel(user?.role)}</span>
        </div>
        <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
          <div 
            className="user-dropdown-overlay"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
          />
          <div className="user-dropdown">
            <div className="user-dropdown-header">
              <div className="user-name">{user?.prenom} {user?.nom}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            
            {isAdmin() && (
              <button 
                className="user-dropdown-item"
                onClick={() => {
                  setIsOpen(false);
                  onShowUserManagement();
                }}
              >
                👥 Gestion des utilisateurs
              </button>
            )}

            <button 
              className="user-dropdown-item"
              onClick={() => {
                setIsOpen(false);
                onShowChangePassword();
              }}
            >
              🔑 Changer le mot de passe
            </button>
            
            <div className="user-dropdown-divider" />
            
            <button 
              className="user-dropdown-item danger"
              onClick={handleLogout}
            >
              <span>🚪</span>
              <span>Déconnexion</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================
// Composant principal de l'application (après connexion)
// ============================================================
const MainApp = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(null);
  const { canWrite } = useAuth();

  // Navigation depuis la recherche globale
  const handleSearchNavigate = (category, itemId) => {
    const categoryToPage = {
      parcelles: 'parcelles',
      arbres: 'arbres',
      recoltes: 'recoltes',
      clients: 'commercial',
      ventes: 'commercial',
      commandes: 'commercial',
      interventions: 'interventions'
    };
    
    const page = categoryToPage[category] || 'dashboard';
    setCurrentPage(page);
    setSearchHighlight({ category, id: itemId });
    
    // Effacer le highlight après 3 secondes
    setTimeout(() => setSearchHighlight(null), 3000);
  };

  const renderPage = () => {
	switch (currentPage) {
	case 'dashboard':
		return <Dashboard />;
    case 'parcelles':
		return <Parcelles highlightId={searchHighlight?.category === 'parcelles' ? searchHighlight.id : null} />;
	case 'arbres':
		return <ArbresPage highlightId={searchHighlight?.category === 'arbres' ? searchHighlight.id : null} />;
	case 'carte':
		return <Carte />;
	case 'interventions':
        return <Interventions highlightId={searchHighlight?.category === 'interventions' ? searchHighlight.id : null} />;
	case 'recoltes':
        return <RecoltesPage highlightId={searchHighlight?.category === 'recoltes' ? searchHighlight.id : null} />;
	case 'commercial':
        return <Commercial highlightId={searchHighlight?.id} highlightCategory={searchHighlight?.category} />;
	case 'statistiques':
        return <Statistiques />;
	case 'previsions':
        return <Previsions />;
	case 'historique':
        return <Historique />;
	case 'parametres':
        return <Parametres />;
	default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src="/truffe-icon.png" 
            alt="Truffe" 
            style={{ width: '32px', height: '32px', marginRight: '10px' }}
          />
          <h1>Gestion de Truffière</h1>
        </div>
        
        <div className="navbar-menu">
          {/* Recherche globale */}
          <GlobalSearch onNavigate={handleSearchNavigate} />
          
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
            className={currentPage === 'commercial' ? 'active' : ''} 
            onClick={() => setCurrentPage('commercial')}
          >
            💼 Commercial
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
          <button 
            className={currentPage === 'historique' ? 'active' : ''} 
            onClick={() => setCurrentPage('historique')}
          >
            📜 Historique
          </button>
          <button 
            className={currentPage === 'parametres' ? 'active' : ''} 
            onClick={() => setCurrentPage('parametres')}
          >
            ⚙️ Paramètres
          </button>
          
          {/* Menu utilisateur */}
          <UserMenu 
            onShowUserManagement={() => setShowUserManagement(true)}
            onShowChangePassword={() => setShowChangePassword(true)}
          />
        </div>
      </nav>
      
      {/* Bandeau lecture seule */}
      {!canWrite() && (
        <div style={{
          background: '#fff3cd',
          color: '#856404',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '14px',
          borderBottom: '1px solid #ffc107'
        }}>
          ⚠️ Mode lecture seule - Vous ne pouvez pas modifier les données
        </div>
      )}
      
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Modal gestion utilisateurs */}
      {showUserManagement && (
        <UserManagement onClose={() => setShowUserManagement(false)} />
      )}

      {/* Modal changement de mot de passe */}
      {showChangePassword && (
        <ChangePassword onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
};

// ============================================================
// Écran de chargement
// ============================================================
const LoadingScreen = () => (
  <div className="login-container">
    <div className="login-card" style={{ textAlign: 'center' }}>
      <div className="spinner" style={{ 
        width: '40px', 
        height: '40px', 
        margin: '0 auto 20px',
        borderColor: 'rgba(139, 90, 43, 0.2)',
        borderTopColor: '#8b5a2b'
      }} />
      <p style={{ color: '#666' }}>Chargement...</p>
    </div>
  </div>
);

// ============================================================
// Composant App avec gestion de l'authentification
// ============================================================
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <MainApp />;
};

// ============================================================
// Export avec Provider
// ============================================================
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
