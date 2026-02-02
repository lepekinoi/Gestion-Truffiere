import React, { useMemo } from 'react';
import {
  getNextSeasonDates,
  getDaysUntilNextSeason,
  getBestPastSeason,
  getLastSeasonSummary
} from '../../utils/seasonUtils';

const COLORS = {
  primary: '#2c5f2d',
  info: '#3498db',
  muted: '#95a5a6',
  light: '#ecf0f1'
};

/**
 * Widget affiché en période hors-saison (juin-août)
 * Affiche un récapitulatif de la dernière saison et le compte à rebours
 */
const OffSeasonWidget = ({ recoltesData }) => {
  // Calcul des stats hors-saison avec useMemo
  const offSeasonData = useMemo(() => {
    if (!recoltesData || recoltesData.length === 0) {
      return null;
    }
    
    // Dates de la prochaine saison
    const nextSeason = getNextSeasonDates();
    
    // Jours jusqu'à la prochaine saison
    const daysUntil = getDaysUntilNextSeason();
    
    // Récapitulatif de la dernière saison
    const lastSeasonSummary = getLastSeasonSummary(recoltesData);
    
    // Meilleure saison historique
    const bestSeason = getBestPastSeason(recoltesData);
    
    return {
      nextSeason,
      daysUntil,
      lastSeasonSummary,
      bestSeason
    };
  }, [recoltesData]);
  
  if (!offSeasonData) {
    return null;
  }
  
  const { nextSeason, daysUntil, lastSeasonSummary, bestSeason } = offSeasonData;
  
  // Formatage de la date de début
  const formatDate = (date) => {
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };
  
  return (
    <section style={styles.container}>
      {/* En-tête hors-saison */}
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.titleIcon}>🌞</span>
          Période Hors-Saison
        </h3>
        <div style={styles.seasonBadge}>
          Juin - Août
        </div>
      </div>
      
      {/* Compte à rebours */}
      <div style={styles.countdown}>
        <div style={styles.countdownLabel}>Prochaine saison dans</div>
        <div style={styles.countdownValue}>
          {daysUntil}
        </div>
        <div style={styles.countdownUnit}>
          jour{daysUntil > 1 ? 's' : ''}
        </div>
        <div style={styles.nextSeasonDate}>
          Début prévu : {formatDate(nextSeason.start)}
        </div>
      </div>
      
      {/* Récapitulatif dernière saison */}
      <div style={styles.summarySection}>
        <h4 style={styles.summaryTitle}>
          📊 Récapitulatif Saison {lastSeasonSummary?.season || 'Dernière'}
        </h4>
        
        {lastSeasonSummary ? (
          <div style={styles.summaryStats}>
            <div style={styles.summaryStatItem}>
              <div style={styles.summaryStatLabel}>Production</div>
              <div style={styles.summaryStatValue}>
                {lastSeasonSummary.production} <span style={styles.summaryStatUnit}>kg</span>
              </div>
            </div>
            
            <div style={styles.summaryStatDivider}></div>
            
            <div style={styles.summaryStatItem}>
              <div style={styles.summaryStatLabel}>Récoltes</div>
              <div style={styles.summaryStatValue}>
                {lastSeasonSummary.count}
              </div>
            </div>
            
            <div style={styles.summaryStatDivider}></div>
            
            <div style={styles.summaryStatItem}>
              <div style={styles.summaryStatLabel}>Moyenne</div>
              <div style={styles.summaryStatValue}>
                {lastSeasonSummary.averagePerRecolte} <span style={styles.summaryStatUnit}>g</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.noData}>Aucune donnée disponible</div>
        )}
      </div>
      
      {/* Record historique */}
      {bestSeason && (
        <div style={styles.recordSection}>
          <div style={styles.recordBadge}>🏆 Record</div>
          <div style={styles.recordContent}>
            <div style={styles.recordSeason}>Saison {bestSeason.season}</div>
            <div style={styles.recordValue}>
              {bestSeason.production} kg
            </div>
            <div style={styles.recordDetail}>
              {bestSeason.count} récoltes
            </div>
          </div>
        </div>
      )}
      
      {/* Message d'encouragement */}
      <div style={styles.message}>
        <span style={styles.messageIcon}>🌱</span>
        <span style={styles.messageText}>
          Période d'entretien et de préparation. La prochaine récolte approche !
        </span>
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
    border: '2px solid #e3f2fd',
    boxShadow: '0 4px 12px rgba(52, 152, 219, 0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '600',
    color: COLORS.info
  },
  titleIcon: {
    fontSize: '1.5rem'
  },
  seasonBadge: {
    padding: '0.4rem 0.9rem',
    backgroundColor: COLORS.info + '20',
    color: COLORS.info,
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  countdown: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    marginBottom: '1.5rem'
  },
  countdownLabel: {
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: '500',
    marginBottom: '0.5rem'
  },
  countdownValue: {
    fontSize: '3.5rem',
    fontWeight: 'bold',
    color: COLORS.info,
    lineHeight: 1
  },
  countdownUnit: {
    fontSize: '1.1rem',
    color: '#666',
    marginTop: '0.5rem',
    marginBottom: '1rem'
  },
  nextSeasonDate: {
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: '500',
    textAlign: 'center'
  },
  summarySection: {
    marginBottom: '1.5rem'
  },
  summaryTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '1rem'
  },
  summaryStats: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px'
  },
  summaryStatItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1
  },
  summaryStatLabel: {
    fontSize: '0.8rem',
    color: '#666',
    fontWeight: '500'
  },
  summaryStatValue: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: COLORS.primary,
    lineHeight: 1
  },
  summaryStatUnit: {
    fontSize: '0.9rem',
    color: '#999',
    fontWeight: 'normal'
  },
  summaryStatDivider: {
    width: '1px',
    height: '35px',
    backgroundColor: '#ddd'
  },
  noData: {
    textAlign: 'center',
    padding: '1rem',
    color: COLORS.muted,
    fontStyle: 'italic'
  },
  recordSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#fff9e6',
    border: '2px solid #ffd700',
    borderRadius: '10px',
    marginBottom: '1rem'
  },
  recordBadge: {
    fontSize: '1.5rem',
    fontWeight: '700'
  },
  recordContent: {
    flex: 1
  },
  recordSeason: {
    fontSize: '0.85rem',
    color: '#666',
    fontWeight: '500',
    marginBottom: '0.25rem'
  },
  recordValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#d4a300',
    lineHeight: 1,
    marginBottom: '0.25rem'
  },
  recordDetail: {
    fontSize: '0.8rem',
    color: '#666'
  },
  message: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: '#e8f5e9',
    borderRadius: '10px',
    border: '1px solid #c8e6c9'
  },
  messageIcon: {
    fontSize: '1.5rem'
  },
  messageText: {
    fontSize: '0.9rem',
    color: COLORS.primary,
    fontWeight: '500',
    lineHeight: 1.4
  }
};

export default OffSeasonWidget;
