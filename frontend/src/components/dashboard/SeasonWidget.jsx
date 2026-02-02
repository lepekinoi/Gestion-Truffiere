import React, { useMemo } from 'react';
import {
  getCurrentSeason,
  calculateSeasonProgress,
  filterRecoltesBySeason,
  compareSeasonsSamePeriod,
  getProgressLabel
} from '../../utils/seasonUtils';

const COLORS = {
  primary: '#2c5f2d',
  primaryLight: '#4a8b4c',
  success: '#27ae60',
  danger: '#e74c3c',
  muted: '#95a5a6'
};

/**
 * Widget affichant les statistiques de la saison truffière en cours
 * avec comparaison même période vs saison précédente
 */
const SeasonWidget = ({ recoltesData }) => {
  const currentSeason = getCurrentSeason();
  
  // Calcul optimisé des stats de saison avec useMemo
  const seasonStats = useMemo(() => {
    if (!recoltesData || recoltesData.length === 0 || !currentSeason) {
      return null;
    }
    
    // Filtrer les récoltes de la saison actuelle
    const seasonRecoltes = filterRecoltesBySeason(recoltesData, currentSeason);
    
    // Production totale en kg
    const totalProduction = seasonRecoltes.reduce((sum, r) => 
      sum + parseFloat(r.poids_grammes || 0), 0
    ) / 1000;
    
    // Nombre de récoltes
    const nbRecoltes = seasonRecoltes.length;
    
    // Progression dans la saison (0-100%)
    const progress = calculateSeasonProgress();
    
    // Label de progression
    const progressLabel = getProgressLabel(progress);
    
    // Comparaison avec même période de la saison précédente
    const previousSeason = `${
      parseInt(currentSeason.split('-')[0]) - 1
    }-${
      parseInt(currentSeason.split('-')[1]) - 1
    }`;
    
    const comparison = compareSeasonsSamePeriod(
      recoltesData,
      currentSeason,
      previousSeason
    );
    
    return {
      totalProduction: totalProduction.toFixed(2),
      nbRecoltes,
      progress,
      progressLabel,
      comparison
    };
  }, [recoltesData, currentSeason]);
  
  if (!seasonStats) {
    return null;
  }
  
  const { totalProduction, nbRecoltes, progress, progressLabel, comparison } = seasonStats;
  
  // Icône de tendance
  const getTrendIcon = () => {
    if (comparison.trend === 'up') return '↗️';
    if (comparison.trend === 'down') return '↘️';
    return '➡️';
  };
  
  // Couleur de tendance
  const getTrendColor = () => {
    if (comparison.trend === 'up') return COLORS.success;
    if (comparison.trend === 'down') return COLORS.danger;
    return COLORS.muted;
  };
  
  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.titleIcon}>🍄</span>
          Saison Truffière {currentSeason}
        </h3>
        <div style={styles.progressBadge}>
          {progressLabel}
        </div>
      </div>
      
      <div style={styles.stats}>
        <div style={styles.statItem}>
          <div style={styles.statLabel}>Production</div>
          <div style={styles.statValue}>
            {totalProduction} <span style={styles.statUnit}>kg</span>
          </div>
        </div>
        
        <div style={styles.statDivider}></div>
        
        <div style={styles.statItem}>
          <div style={styles.statLabel}>Récoltes</div>
          <div style={styles.statValue}>
            {nbRecoltes}
          </div>
        </div>
        
        <div style={styles.statDivider}></div>
        
        <div style={styles.statItem}>
          <div style={styles.statLabel}>Progression</div>
          <div style={styles.statValue}>
            {progress}<span style={styles.statUnit}>%</span>
          </div>
        </div>
      </div>
      
      {/* Barre de progression visuelle */}
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBarTrack}>
          <div style={{
            ...styles.progressBarFill,
            width: `${progress}%`
          }} />
        </div>
        <div style={styles.progressText}>
          {progress}% de la saison complétée
        </div>
      </div>
      
      {/* Comparaison même période */}
      <div style={{
        ...styles.comparison,
        backgroundColor: comparison.trend === 'up' ? '#d4edda' : 
                         comparison.trend === 'down' ? '#f8d7da' : '#e2e3e5'
      }}>
        <div style={{
          ...styles.comparisonContent,
          color: getTrendColor()
        }}>
          <span style={styles.trendIcon}>{getTrendIcon()}</span>
          <span style={styles.comparisonText}>
            {comparison.percentChange > 0 ? '+' : ''}{comparison.percentChange}%
          </span>
          <span style={styles.comparisonLabel}>
            vs même période saison dernière
          </span>
        </div>
        <div style={styles.comparisonDetail}>
          ({comparison.previousProduction} kg en {currentSeason.split('-')[0]}-{parseInt(currentSeason.split('-')[1]) - 1})
        </div>
      </div>
    </section>
  );
};

const styles = {
  container: {
    backgroundColor: '#fff',
    padding: '1.5rem',
    borderRadius: '16px',
    marginBottom: '1.5rem',
    border: '2px solid #e8f5e9',
    boxShadow: '0 4px 12px rgba(44, 95, 45, 0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '600',
    color: COLORS.primary
  },
  titleIcon: {
    fontSize: '1.5rem'
  },
  progressBadge: {
    padding: '0.4rem 0.9rem',
    backgroundColor: COLORS.primaryLight + '20',
    color: COLORS.primary,
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: '1.5rem'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1
  },
  statLabel: {
    fontSize: '0.85rem',
    color: '#666',
    fontWeight: '500'
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: COLORS.primary,
    lineHeight: 1
  },
  statUnit: {
    fontSize: '1rem',
    color: '#999',
    fontWeight: 'normal'
  },
  statDivider: {
    width: '1px',
    height: '40px',
    backgroundColor: '#e0e0e0'
  },
  progressBarContainer: {
    marginBottom: '1rem'
  },
  progressBarTrack: {
    width: '100%',
    height: '12px',
    backgroundColor: '#e8f5e9',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '0.5rem'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: '6px',
    transition: 'width 0.6s ease-in-out'
  },
  progressText: {
    fontSize: '0.8rem',
    color: '#666',
    textAlign: 'center'
  },
  comparison: {
    padding: '1rem',
    borderRadius: '10px',
    border: '1px solid rgba(0,0,0,0.1)'
  },
  comparisonContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: '600',
    fontSize: '1rem',
    marginBottom: '0.25rem'
  },
  trendIcon: {
    fontSize: '1.2rem'
  },
  comparisonText: {
    fontSize: '1.1rem'
  },
  comparisonLabel: {
    fontSize: '0.9rem',
    opacity: 0.9
  },
  comparisonDetail: {
    fontSize: '0.85rem',
    color: '#666',
    textAlign: 'center'
  }
};

export default SeasonWidget;
