import React, { useState, useEffect } from 'react';
import { useArbres } from '../hooks/useArbres';
import './ArbresPage.css';

const ArbresPage = () => {
  const { arbres, loading, error } = useArbres();
  const [selectedArbre, setSelectedArbre] = useState(null);

  return (
    <div className="arbres-page">
      <h1>Gestion des Arbres</h1>
      
      {loading && <div className="loading">Chargement...</div>}
      {error && <div className="error">Erreur: {error}</div>}
      
      {!loading && !error && (
        <div className="arbres-container">
          <div className="arbres-list">
            {arbres && arbres.length > 0 ? (
              <ul>
                {arbres.map(arbre => (
                  <li 
                    key={arbre.id} 
                    onClick={() => setSelectedArbre(arbre)}
                    className={selectedArbre?.id === arbre.id ? 'active' : ''}
                  >
                    {arbre.nom || `Arbre ${arbre.id}`}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucun arbre disponible</p>
            )}
          </div>
          
          {selectedArbre && (
            <div className="arbre-detail">
              <h2>Détails de l'arbre</h2>
              <pre>{JSON.stringify(selectedArbre, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArbresPage;
