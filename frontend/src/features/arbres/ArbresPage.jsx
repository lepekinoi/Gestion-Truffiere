import React from 'react';

import ArbresFilters from './components/ArbresFilters';
import ArbresTable from './components/ArbresTable';
import ArbresPagination from './components/ArbresPagination';
import ArbresEmptyState from './components/ArbresEmptyState';

import ArbresFormModal from './components/ArbresFormModal';
import ArbresBulkEditModal from './components/ArbresBulkEditModal';
import ArbresTrashModal from './components/ArbresTrashModal';
import ArbresImportModal from './components/ArbresImportModal';
import ArbresConfirmModal from './components/ArbresConfirmModal';

import useArbresData from './hooks/useArbresData';
import useArbresFilters from './hooks/useArbresFilters';
import useArbresPagination from './hooks/useArbresPagination';
import useArbresSelection from './hooks/useArbresSelection';
import useArbresMap from './hooks/useArbresMap';

import { useColumnSettings, COLONNES_CONFIG } from '../../hooks/useColumnSettings';

export default function ArbresPage() {
  // Données + CRUD
  const {
    arbres,
    parcelles,
    interventions,
    loading,
    message,
    showMessage,
    isProcessing,
    loadData,

    showModal,
    setShowModal,
    editingArbre,
    setEditingArbre,
    handleSubmit,
    handleEdit,
    askDelete,

    showCorbeille,
    setShowCorbeille,
    arbresCorbeille,
    loadingCorbeille,
    handleRestaurer,
    askSupprimerDefinitivement,
    askViderCorbeille,

    showImportModal,
    setShowImportModal,
    handleImportCSV,
    handleExportPDF
  } = useArbresData();

  // Filtres
  const {
    filters,
    filterOptions,
    filteredArbres,
    hasActiveFilters,
    handleFilterChange,
    resetFilters
  } = useArbresFilters(arbres);

  // Pagination
  const {
    paginatedArbres,
    itemsPerPage,
    currentPage,
    totalPages,
    totalItems,
    handleItemsPerPageChange,
    setCurrentPage,
    getPageNumbers
  } = useArbresPagination(filteredArbres);

  // Colonnes configurables
  const { colonnesAffichees } = useColumnSettings('arbres');
  const config = COLONNES_CONFIG.arbres;
  const colonnesValides = colonnesAffichees.filter(col => config[col]);

  // Sélection multiple
  const {
    selectedArbres,
    handleSelectArbre,
    handleSelectAllPage,
    handleSelectAllFiltered,
    handleDeselectAll,
    isAllPageSelected,
    isSomePageSelected,
    showBulkEditModal,
    setShowBulkEditModal,
    bulkEditData,
    handleBulkEditChange,
    handleBulkEditSubmit,
    askBulkDelete
  } = useArbresSelection({
    arbres,
    filteredArbres,
    paginatedArbres,
    showMessage,
    loadData,
    askDelete
  });

  // Carte + géolocalisation
  const {
    formData,
    setFormData,
    selectedParcelleCoords,
    setSelectedParcelleCoords,
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    mapKey,
    setMapKey,
    showMap,
    setShowMap,
    handleInputChange,
    handleMapClick,
    clearPosition,
    getSelectedParcelleName
  } = useArbresMap({ parcelles, editingArbre });

  // Tooltip interventions
  const [hoveredArbreId, setHoveredArbreId] = React.useState(null);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });

  const getInterventionsForArbre = (id) =>
    interventions
      .filter(i => i.arbre_id === id && ['Planifié', 'En cours'].includes(i.statut))
      .sort((a, b) => new Date(a.date_prevue) - new Date(b.date_prevue));

  const hasInterventions = (id) => getInterventionsForArbre(id).length > 0;

  const handleMouseEnter = (e, id) => {
    const list = getInterventionsForArbre(id);
    if (list.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({ x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 5 });
    setHoveredArbreId(id);
  };

  const handleMouseLeave = () => setHoveredArbreId(null);

  const renderCell = (arbre, col) => {
    if (col === 'numero') {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong>{config[col].render(arbre)}</strong>
          {hasInterventions(arbre.id) && (
            <span
              title="Interventions en cours ou prévues"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#3498db',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '0.75rem'
              }}
            />
          )}
        </span>
      );
    }
    if (col === 'etat') {
      const styles = {
        'Bon': { background: '#d4edda', color: '#155724' },
        'Moyen': { background: '#fff3cd', color: '#856404' },
        'Mauvais': { background: '#f8d7da', color: '#721c24' },
        'Mort': { background: '#e0e0e0', color: '#666' }
      };
      return (
        <span style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: '500',
          ...styles[arbre.etat]
        }}>
          {arbre.etat}
        </span>
      );
    }
    return config[col].render(arbre);
  };

  if (loading) return <div className="loading">Chargement des arbres...</div>;

  const totalArbres = filteredArbres.length;

  return (
    <div className="page-container">
      {/* Notification */}
      <ArbresConfirmModal message={message} />

      {/* Header */}
      <div className="page-header">
        <h2>🌳 Gestion des arbres truffiers</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setShowCorbeille(true); }}
            style={{ background: '#6c757d' }}
          >
            🗑️ Corbeille
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            📥 Importer CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportPDF}
            disabled={filteredArbres.length === 0}
          >
            📄 Exporter PDF
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { setEditingArbre(null); setShowModal(true); }}
          >
            ➕ Nouvel arbre
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="card">
          <div className="card-title">Total arbres</div>
          <div className="card-value">{arbres.length}</div>
        </div>
        <div className="card">
          <div className="card-title">En bon état</div>
          <div className="card-value" style={{ color: '#27ae60' }}>
            {arbres.filter(a => a.etat === 'Bon').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">À surveiller</div>
          <div className="card-value" style={{ color: '#f39c12' }}>
            {arbres.filter(a => a.etat === 'Moyen').length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">En difficulté</div>
          <div className="card-value" style={{ color: '#e74c3c' }}>
            {arbres.filter(a => a.etat === 'Mauvais' || a.etat === 'Mort').length}
          </div>
        </div>
      </div>

      {/* Barre sélection groupée */}
      {selectedArbres.size > 0 && (
        <div style={{
          background: '#e3f2fd',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1rem',
          border: '2px solid #1976d2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
              ✅ {selectedArbres.size} arbre(s) sélectionné(s)
            </span>
            <button
              onClick={handleDeselectAll}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'transparent',
                border: '1px solid #1976d2',
                borderRadius: '6px',
                color: '#1976d2',
                cursor: 'pointer'
              }}
            >
              Tout désélectionner
            </button>
            {filteredArbres.length > selectedArbres.size && (
              <button
                onClick={handleSelectAllFiltered}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: 'transparent',
                  border: '1px solid #1976d2',
                  borderRadius: '6px',
                  color: '#1976d2',
                  cursor: 'pointer'
                }}
              >
                Sélectionner les {filteredArbres.length} arbres filtrés
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowBulkEditModal(true)}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem' }}
            >
              ✏️ Modifier la sélection
            </button>
            <button
              onClick={askBulkDelete}
              className="btn btn-danger"
              style={{ padding: '0.5rem 1rem' }}
            >
              🗑️ Supprimer la sélection
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <ArbresFilters
        filters={filters}
        filterOptions={filterOptions}
        hasActiveFilters={hasActiveFilters}
        onChange={handleFilterChange}
        onReset={resetFilters}
        total={arbres.length}
        filtered={filteredArbres.length}
      />

      {/* Pagination top (infos) */}
      {filteredArbres.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: '500', color: '#666' }}>Afficher :</span>
            {[10, 25, 50, 100, 'all'].map(value => (
              <button
                key={value}
                onClick={() => handleItemsPerPageChange(value)}
                style={{
                  padding: '0.4rem 0.8rem',
                  border: itemsPerPage === value ? '2px solid #2c5f2d' : '1px solid #ddd',
                  borderRadius: '6px',
                  background: itemsPerPage === value ? '#e8f5e9' : 'white',
                  color: itemsPerPage === value ? '#2c5f2d' : '#666',
                  fontWeight: itemsPerPage === value ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {value === 'all' ? 'Tous' : value}
              </button>
            ))}
          </div>

          {itemsPerPage !== 'all' && (
            <div style={{ color: '#666', fontSize: '0.9rem' }}>
              Affichage de {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, totalArbres)} sur {totalArbres} arbres
            </div>
          )}
        </div>
      )}

      {/* Tableau / vide */}
      {filteredArbres.length === 0 ? (
        <ArbresEmptyState
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          onAdd={() => { setEditingArbre(null); setShowModal(true); }}
        />
      ) : (
        <>
          <ArbresTable
            arbres={paginatedArbres}
            colonnes={colonnesValides}
            config={config}
            selected={selectedArbres}
            onSelect={handleSelectArbre}
            onSelectAllPage={handleSelectAllPage}
            isAllPageSelected={isAllPageSelected}
            isSomePageSelected={isSomePageSelected}
            onEdit={(arbre) => handleEdit(arbre, () => setShowModal(true), setFormData)}
            onDelete={askDelete}
            interventions={interventions}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            hasInterventions={hasInterventions}
            renderCell={renderCell}
          />

          <ArbresPagination
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onChangePage={setCurrentPage}
            onChangeItemsPerPage={handleItemsPerPageChange}
            getPageNumbers={getPageNumbers}
          />
        </>
      )}

      {/* Modales */}
      <ArbresFormModal
        show={showModal}
        onClose={() => setShowModal(false)}
        formData={formData}
        setFormData={setFormData}
        parcelles={parcelles}
        selectedParcelleCoords={selectedParcelleCoords}
        setSelectedParcelleCoords={setSelectedParcelleCoords}
        mapCenter={mapCenter}
        setMapCenter={setMapCenter}
        mapKey={mapKey}
        setMapKey={setMapKey}
        showMap={showMap}
        setShowMap={setShowMap}
        handleInputChange={handleInputChange}
        handleMapClick={handleMapClick}
        clearPosition={clearPosition}
        getSelectedParcelleName={getSelectedParcelleName}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
      />

      <ArbresBulkEditModal
        show={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        selectedCount={selectedArbres.size}
        bulkEditData={bulkEditData}
        onChange={handleBulkEditChange}
        onSubmit={handleBulkEditSubmit}
        isProcessing={isProcessing}
      />

      <ArbresTrashModal
        show={showCorbeille}
        onClose={() => setShowCorbeille(false)}
        arbres={arbresCorbeille}
        loading={loadingCorbeille}
        onRestore={handleRestaurer}
        onDeletePermanent={askSupprimerDefinitivement}
        onEmptyTrash={askViderCorbeille}
        formatDate={(d) => new Date(d).toLocaleString('fr-FR')}
      />

      <ArbresImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
        parcelles={parcelles}
      />

      {/* Tooltip interventions */}
	{hoveredArbreId && (
	  <div style={{
		position: 'fixed',
		left: tooltipPosition.x,
		top: tooltipPosition.y,
		background: 'white',
		border: '1px solid #ddd',
		borderRadius: '8px',
		boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
		padding: '0.75rem 1rem',
		zIndex: 9999,
		maxWidth: '350px',
		minWidth: '250px'
	  }}>
          <div style={{
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: '#2c3e50',
            borderBottom: '1px solid #eee',
            paddingBottom: '0.5rem'
          }}>
            🌧️ Interventions prévues
          </div>
          {getInterventionsForArbre(hoveredArbreId).map((intervention, idx) => (
            <div key={intervention.id} style={{
              padding: '0.5rem 0',
              borderBottom: idx < getInterventionsForArbre(hoveredArbreId).length - 1 ? '1px solid #f0f0f0' : 'none'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.25rem'
              }}>
                <span style={{ fontWeight: '500', color: '#34495e' }}>
                  {intervention.type_nom || 'Intervention'}
                </span>
                <span style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  background: intervention.statut === 'En cours' ? '#fff3cd' : '#cce5ff',
                  color: intervention.statut === 'En cours' ? '#856404' : '#004085'
                }}>
                  {intervention.statut}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                📅 {new Date(intervention.date_prevue).toLocaleDateString('fr-FR')}
                {intervention.personnel && (
                  <span style={{ marginLeft: '0.75rem' }}>👤 {intervention.personnel}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
