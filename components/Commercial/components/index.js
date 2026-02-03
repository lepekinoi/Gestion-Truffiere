// ============================================================
// components/index.js - Export centralisé des composants UI
// ============================================================

export { default as StatsCard } from './StatsCard';
export { default as StatusBadge } from './StatusBadge';
export { default as PaginationControls } from './PaginationControls';
export { default as ClientTile } from './ClientTile';

/**
 * Utilisation simplifiée :
 * 
 * import { StatsCard, StatusBadge, PaginationControls, ClientTile } from './components';
 * 
 * // Au lieu de :
 * import StatsCard from './components/StatsCard';
 * import StatusBadge from './components/StatusBadge';
 * // etc.
 */
