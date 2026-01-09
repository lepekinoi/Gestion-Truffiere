/**
 * Utilitaire d'import CSV pour l'application TruffiÃ¨re
 * Gestion complÃ¨te de l'encodage UTF-8 avec BOM pour Excel
 */

import Papa from 'papaparse';

/**
 * Parse un fichier CSV et retourne les donnÃ©es
 * GÃ¨re automatiquement UTF-8 avec ou sans BOM
 */
export const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      transformHeader: (header) => {
        // Nettoyer les headers (supprimer BOM invisible et espaces)
        return header.trim().replace(/^\uFEFF/, '').replace(/^\ufeff/, '');
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          // Filtrer les erreurs non critiques
          const criticalErrors = results.errors.filter(e => 
            e.type !== 'Quotes' && e.type !== 'FieldMismatch'
          );
          if (criticalErrors.length > 0) {
            reject(new Error(`Erreurs: ${criticalErrors.map(e => e.message).join(', ')}`));
          } else {
            resolve(results.data);
          }
        } else {
          resolve(results.data);
        }
      },
      error: (error) => reject(error)
    });
  });
};

/**
 * Valide les donnÃ©es de parcelles
 */
export const validateParcellesCSV = (data) => {
  const errors = [];
  const validData = [];

  data.forEach((row, index) => {
    const rowNum = index + 2;
    
    if (!row.nom || row.nom.trim() === '') {
      errors.push(`Ligne ${rowNum}: Le nom est obligatoire`);
      return;
    }
    
    if (!row.surface_ha || isNaN(parseFloat(row.surface_ha))) {
      errors.push(`Ligne ${rowNum}: La surface est obligatoire`);
      return;
    }

    validData.push({
      nom: row.nom.trim(),
      surface_ha: parseFloat(row.surface_ha),
      type_sol: row.type_sol?.trim() || null,
      ph_sol: row.ph_sol ? parseFloat(row.ph_sol) : null,
      exposition: row.exposition?.trim() || null,
      notes: row.notes?.trim() || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ©es d'arbres
 */
export const validateArbresCSV = (data, parcelles) => {
  const errors = [];
  const validData = [];
  const parcelleMap = {};
  
  parcelles.forEach(p => parcelleMap[p.nom.toLowerCase()] = p.id);

  data.forEach((row, index) => {
    const rowNum = index + 2;
    
    if (!row.numero || !row.parcelle_nom || !row.espece) {
      errors.push(`Ligne ${rowNum}: Champs obligatoires manquants`);
      return;
    }

    const parcelleId = parcelleMap[row.parcelle_nom.trim().toLowerCase()];
    if (!parcelleId) {
      errors.push(`Ligne ${rowNum}: Parcelle "${row.parcelle_nom}" introuvable`);
      return;
    }

    if (!row.date_plantation || isNaN(Date.parse(row.date_plantation))) {
      errors.push(`Ligne ${rowNum}: Date invalide (YYYY-MM-DD)`);
      return;
    }

    validData.push({
      parcelle_id: parcelleId,
      numero: row.numero.trim(),
      espece: row.espece.trim(),
      variete_truffe: row.variete_truffe?.trim() || null,
      date_plantation: row.date_plantation,
      etat: row.etat?.trim() || 'Bon',
      circonference_cm: row.circonference_cm ? parseFloat(row.circonference_cm) : null,
      hauteur_m: row.hauteur_m ? parseFloat(row.hauteur_m) : null,
      notes: row.notes?.trim() || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ©es de rÃ©coltes
 */
export const validateRecoltesCSV = (data, parcelles, arbres) => {
  const errors = [];
  const validData = [];
  
  const parcelleMap = {};
  parcelles.forEach(p => parcelleMap[p.nom.toLowerCase()] = p.id);
  
  const arbreMap = {};
  arbres.forEach(a => arbreMap[a.numero.toLowerCase()] = a.id);

  data.forEach((row, index) => {
    const rowNum = index + 2;
    
    if (!row.date_recolte || isNaN(Date.parse(row.date_recolte))) {
      errors.push(`Ligne ${rowNum}: Date invalide`);
      return;
    }
    
    if (!row.poids_grammes || isNaN(parseFloat(row.poids_grammes))) {
      errors.push(`Ligne ${rowNum}: Poids obligatoire`);
      return;
    }

    let parcelleId = null;
    if (row.parcelle_nom) {
      parcelleId = parcelleMap[row.parcelle_nom.trim().toLowerCase()];
    }

    let arbreId = null;
    if (row.arbre_numero) {
      arbreId = arbreMap[row.arbre_numero.trim().toLowerCase()];
    }

    validData.push({
      parcelle_id: parcelleId,
      arbre_id: arbreId,
      date_recolte: row.date_recolte,
      poids_grammes: parseFloat(row.poids_grammes),
      qualite: row.qualite?.trim() || null,
      calibre: row.calibre?.trim() || null,
      maturite: row.maturite?.trim() || null,
      caveur: row.caveur?.trim() || null,
      chien: row.chien?.trim() || null,
      notes: row.notes?.trim() || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ©es de clients
 */
export const validateClientsCSV = (data) => {
  const errors = [];
  const validData = [];

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const type = row.type?.trim() || 'Particulier';

    if (type === 'Particulier' && (!row.nom || row.nom.trim() === '')) {
      errors.push(`Ligne ${rowNum}: Nom obligatoire`);
      return;
    }
    
    if (type !== 'Particulier' && (!row.raison_sociale || row.raison_sociale.trim() === '')) {
      errors.push(`Ligne ${rowNum}: Raison sociale obligatoire`);
      return;
    }

    validData.push({
      type: type,
      nom: row.nom?.trim() || null,
      prenom: row.prenom?.trim() || null,
      raison_sociale: row.raison_sociale?.trim() || null,
      email: row.email?.trim() || null,
      telephone: row.telephone?.trim() || null,
      adresse: row.adresse?.trim() || null,
      code_postal: row.code_postal?.trim() || null,
      ville: row.ville?.trim() || null,
      pays: row.pays?.trim() || 'France',
      siret: row.siret?.trim() || null,
      notes: row.notes?.trim() || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ©es de ventes
 */
export const validateVentesCSV = (data, clients) => {
  const errors = [];
  const validData = [];
  
  const clientMap = {};
  clients.forEach(c => {
    const key = c.type === 'Particulier' 
      ? `${c.nom || ''} ${c.prenom || ''}`.toLowerCase().trim()
      : (c.raison_sociale || '').toLowerCase().trim();
    if (key) clientMap[key] = c.id;
  });

  data.forEach((row, index) => {
    const rowNum = index + 2;
    
    if (!row.date_vente || isNaN(Date.parse(row.date_vente))) {
      errors.push(`Ligne ${rowNum}: Date invalide`);
      return;
    }
    
    if (!row.client_nom) {
      errors.push(`Ligne ${rowNum}: Client obligatoire`);
      return;
    }
    
    const clientId = clientMap[row.client_nom.trim().toLowerCase()];
    if (!clientId) {
      errors.push(`Ligne ${rowNum}: Client "${row.client_nom}" introuvable`);
      return;
    }

    if (!row.quantite_grammes || isNaN(parseFloat(row.quantite_grammes))) {
      errors.push(`Ligne ${rowNum}: QuantitÃ© obligatoire`);
      return;
    }

    validData.push({
      client_id: clientId,
      recolte_id: null,
      date_vente: row.date_vente,
      quantite_grammes: parseFloat(row.quantite_grammes),
      prix_unitaire_kg: row.prix_unitaire_kg ? parseFloat(row.prix_unitaire_kg) : null,
      mode_paiement: row.mode_paiement?.trim() || null,
      statut: row.statut?.trim() || 'En attente',
      numero_facture: row.numero_facture?.trim() || null,
      notes: row.notes?.trim() || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ©es d'interventions
 */
export const validateInterventionsCSV = (data, parcelles, typesIntervention) => {
  const errors = [];
  const validData = [];
  
  const parcelleMap = {};
  parcelles.forEach(p => parcelleMap[p.nom.toLowerCase()] = p.id);
  
  const typeMap = {};
  typesIntervention.forEach(t => typeMap[t.nom.toLowerCase()] = t.id);

  data.forEach((row, index) => {
    const rowNum = index + 2;
    
    if (!row.type_intervention) {
      errors.push(`Ligne ${rowNum}: Type obligatoire`);
      return;
    }
    
    const typeId = typeMap[row.type_intervention.trim().toLowerCase()];
    if (!typeId) {
      errors.push(`Ligne ${rowNum}: Type "${row.type_intervention}" introuvable`);
      return;
    }

    let parcelleId = null;
    if (row.parcelle_nom) {
      parcelleId = parcelleMap[row.parcelle_nom.trim().toLowerCase()];
    }

    if (!row.date_prevue || isNaN(Date.parse(row.date_prevue))) {
      errors.push(`Ligne ${rowNum}: Date invalide`);
      return;
    }

    validData.push({
      type_intervention_id: typeId,
      parcelle_id: parcelleId,
      arbre_id: null,
      date_prevue: row.date_prevue,
      date_realisee: row.date_realisee || null,
      duree_minutes: row.duree_minutes ? parseInt(row.duree_minutes) : null,
      personnel: row.personnel?.trim() || null,
      description: row.description?.trim() || null,
      cout: row.cout ? parseFloat(row.cout) : null,
      statut: row.statut?.trim() || 'PlanifiÃ©',
      meteo: row.meteo?.trim() || null,
      notes: row.notes?.trim() || null
    });
  });

  return { validData, errors };
};

/**
 * GÃ©nÃ¨re un template CSV
 */
export const generateCSVTemplate = (type) => {
  const templates = {
    parcelles: 'nom,surface_ha,type_sol,ph_sol,exposition,notes\n' +
               'Parcelle Nord,2.5,Calcaire,7.8,Sud,PremiÃ¨re parcelle',
    
    arbres: 'numero,parcelle_nom,espece,variete_truffe,date_plantation,etat,circonference_cm,hauteur_m,notes\n' +
            'A001,Parcelle Nord,ChÃªne pubescent,Tuber melanosporum,2020-03-15,Bon,45,3.5,Premier arbre',
    
    recoltes: 'date_recolte,parcelle_nom,arbre_numero,poids_grammes,qualite,calibre,maturite,caveur,chien,notes\n' +
              '2024-12-15,Parcelle Nord,A001,450,Extra,Moyen (20-50g),À point,Jean Dupont,Max,Belle récolte',
    
    clients: 'type,nom,prenom,raison_sociale,email,telephone,adresse,code_postal,ville,pays,siret,notes\n' +
             'Particulier,Dupont,Jean,,jean.dupont@email.com,0601020304,1 rue de la Truffe,85140,Les Essarts,France,,Client fidÃ¨le',
    
    ventes: 'date_vente,client_nom,quantite_grammes,prix_unitaire_kg,mode_paiement,statut,numero_facture,notes\n' +
            '2024-12-20,Dupont Jean,500,800,ChÃ¨que,PayÃ©e,F-2024-001,Vente directe',
    
    interventions: 'type_intervention,parcelle_nom,date_prevue,date_realisee,duree_minutes,personnel,cout,statut,notes\n' +
                   'Irrigation,Parcelle Nord,2024-01-15,2024-01-15,120,Jean Dupont,50,TerminÃ©,Irrigation'
  };

  return templates[type] || '';
};

/**
 * TÃ©lÃ©charge un template CSV avec UTF-8 BOM
 */
export const downloadCSVTemplate = (type) => {
  const template = generateCSVTemplate(type);
  
  // BOM UTF-8 pour Excel
  const BOM = '\uFEFF';
  const csvContent = BOM + template;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `template_${type}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 100);
};

export default {
  parseCSVFile,
  validateParcellesCSV,
  validateArbresCSV,
  validateRecoltesCSV,
  validateClientsCSV,
  validateVentesCSV,
  validateInterventionsCSV,
  generateCSVTemplate,
  downloadCSVTemplate
};