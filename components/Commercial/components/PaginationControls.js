// ============================================================
// PaginationControls.js - Composant de contrôles de pagination
// ============================================================
// Affiche les contrôles de navigation entre les pages
// Avec boutons de navigation et sélecteur de nombre d'éléments par page
// ============================================================

import React from 'react';
import { PAGINATION_DEFAULTS } from '../utils/constants';

/**
 * Composant PaginationControls - Contrôles de pagination
 * 
 * @param {Object} props - Propriétés du composant
 * @param {number} props.currentPage - Page actuelle (1-indexée)
 * @param {Function} props.setCurrentPage - Fonction pour changer de page
 * @param {number} props.totalItems - Nombre total d'éléments
 * @param {number} props.itemsPerPage - Nombre d'éléments par page
 * @param {Function} props.setItemsPerPage - Fonction pour changer le nombre d'éléments par page
 * @param {Array<number>} [props.pageSizeOptions] - Options de taille de page
 * @param {boolean} [props.showInfo=true] - Afficher les informations "X-Y sur Z"
 * @param {Object} [props.style] - Styles CSS supplémentaires
 */
const PaginationControls = ({
  currentPage,
  setCurrentPage,
  totalItems,
  itemsPerPage,
  setItemsPerPage,
  pageSizeOptions = PAGINATION_DEFAULTS.PAGE_SIZE_OPTIONS,
  showInfo = true,
  style = {}
}) => {
  // Calculer le nombre total de pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Ne rien afficher si une seule page ou aucun élément
  if (totalPages <= 1 || totalItems === 0) return null;
  
  // Calculer les index de début et fin pour l'affichage
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
  
  // Handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(Math.max(1, currentPage - 1));
  const goToNextPage = () => setCurrentPage(Math.min(totalPages, currentPage + 1));
  const goToLastPage = () => setCurrentPage(totalPages);
  
  const handlePageSizeChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset à la première page
  };
  
  // Styles des boutons
  const buttonStyle = (disabled) => ({
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: disabled ? '#f0f0f0' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    opacity: disabled ? 0.5 : 1
  });
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '20px',
        padding: '15px',
        background: '#f8f9fa',
        borderRadius: '8px',
        flexWrap: 'wrap',
        gap: '15px',
        ...style
      }}
    >
      {/* Informations d'affichage */}
      {showInfo && (
        <div style={{ fontSize: '14px', color: '#666' }}>
          Affichage {startIndex} - {endIndex} sur {totalItems}
        </div>
      )}
      
      {/* Contrôles de navigation */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Bouton première page */}
        <button
          onClick={goToFirstPage}
          disabled={currentPage === 1}
          style={buttonStyle(currentPage === 1)}
          title="Première page"
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          {'«'}
        </button>
        
        {/* Bouton page précédente */}
        <button
          onClick={goToPreviousPage}
          disabled={currentPage === 1}
          style={buttonStyle(currentPage === 1)}
          title="Page précédente"
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          {'‹'}
        </button>
        
        {/* Indicateur de page */}
        <span style={{ padding: '0 15px', fontWeight: 600, fontSize: '14px' }}>
          Page {currentPage} / {totalPages}
        </span>
        
        {/* Bouton page suivante */}
        <button
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
          style={buttonStyle(currentPage === totalPages)}
          title="Page suivante"
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          {'›'}
        </button>
        
        {/* Bouton dernière page */}
        <button
          onClick={goToLastPage}
          disabled={currentPage === totalPages}
          style={buttonStyle(currentPage === totalPages)}
          title="Dernière page"
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = '#e9ecef';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          {'»'}
        </button>
        
        {/* Sélecteur de taille de page */}
        <select
          value={itemsPerPage}
          onChange={handlePageSizeChange}
          style={{
            marginLeft: '20px',
            padding: '6px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer',
            background: 'white'
          }}
          title="Éléments par page"
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default PaginationControls;

/**
 * Exemple d'utilisation :
 * 
 * const [currentPage, setCurrentPage] = useState(1);
 * const [itemsPerPage, setItemsPerPage] = useState(50);
 * const data = [...]; // Vos données
 * 
 * <PaginationControls
 *   currentPage={currentPage}
 *   setCurrentPage={setCurrentPage}
 *   totalItems={data.length}
 *   itemsPerPage={itemsPerPage}
 *   setItemsPerPage={setItemsPerPage}
 * />
 */
