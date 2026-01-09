import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Utilitaire d'export PDF pour l'application TruffiÃ¨re
 */

// Configuration des couleurs du thÃ¨me
const COLORS = {
  primary: '#2c5f2d',
  secondary: '#97bc62',
  text: '#2c3e50',
  lightGray: '#ecf0f1',
  border: '#bdc3c7'
};

/**
 * Fonction gÃ©nÃ©rique pour crÃ©er un PDF avec en-tÃªte et pied de page
 */
const createBasePDF = (title, subtitle = '') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // En-tÃªte
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ðŸ„ Gestion de TruffiÃ¨re', pageWidth / 2, 12, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 22, { align: 'center' });

  // Sous-titre si fourni
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text);
    doc.text(subtitle, 14, 38);
  }

  // Date de gÃ©nÃ©ration
  doc.setFontSize(9);
  doc.setTextColor(COLORS.text);
  const dateStr = `GÃ©nÃ©rÃ© le ${new Date().toLocaleDateString('fr-FR')} Ã  ${new Date().toLocaleTimeString('fr-FR')}`;
  doc.text(dateStr, pageWidth - 14, 38, { align: 'right' });

  // Pied de page
  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${doc.internal.getNumberOfPages()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  };

  return { doc, addFooter, startY: 45 };
};

/**
 * Export PDF : Liste des parcelles
 */
export const exportParcellesPDF = (parcelles) => {
  const { doc, addFooter, startY } = createBasePDF(
    'Rapport des Parcelles',
    `Total : ${parcelles.length} parcelle(s)`
  );

  const tableData = parcelles.map(p => [
    p.nom,
    `${p.surface_ha} ha`,
    p.type_sol || '-',
    p.ph_sol ? `pH ${p.ph_sol}` : '-',
    p.exposition || '-',
    new Date(p.date_creation).toLocaleDateString('fr-FR')
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Nom', 'Surface', 'Type de sol', 'pH', 'Exposition', 'Date crÃ©ation']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 30 },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 30, halign: 'center' }
    },
    didDrawPage: addFooter
  });

  if (parcelles.some(p => p.notes)) {
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes :', 14, finalY);
    
    let currentY = finalY + 7;
    parcelles.forEach(p => {
      if (p.notes) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${p.nom} : ${p.notes}`, 14, currentY, { maxWidth: 180 });
        currentY += 7;
      }
    });
  }

  doc.save(`parcelles_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des arbres
 */
export const exportArbresPDF = (arbres, parcelleFilter = null) => {
  const filteredArbres = parcelleFilter 
    ? arbres.filter(a => a.parcelle_id === parcelleFilter)
    : arbres;

  const { doc, addFooter, startY } = createBasePDF(
    'Inventaire des Arbres Truffiers',
    parcelleFilter 
      ? `Parcelle filtrÃ©e - Total : ${filteredArbres.length} arbre(s)`
      : `Total : ${filteredArbres.length} arbre(s)`
  );

  const tableData = filteredArbres.map(a => [
    a.numero,
    a.espece,
    a.variete_truffe || '-',
    a.parcelle_nom || '-',
    a.etat,
    new Date(a.date_plantation).toLocaleDateString('fr-FR'),
    a.circonference_cm ? `${a.circonference_cm} cm` : '-'
  ]);

  doc.autoTable({
    startY: startY,
    head: [['NumÃ©ro', 'EspÃ¨ce', 'VariÃ©tÃ© truffe', 'Parcelle', 'Ã‰tat', 'Plantation', 'Circonf.']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 9,
      cellPadding: 4
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 30 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' }
    },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistiques :', 14, finalY);
  
  const stats = {
    'Bon': filteredArbres.filter(a => a.etat === 'Bon').length,
    'Moyen': filteredArbres.filter(a => a.etat === 'Moyen').length,
    'Mauvais': filteredArbres.filter(a => a.etat === 'Mauvais').length,
    'Mort': filteredArbres.filter(a => a.etat === 'Mort').length
  };

  let statY = finalY + 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  Object.entries(stats).forEach(([etat, count]) => {
    if (count > 0) {
      doc.text(`  â€¢ ${etat} : ${count} arbre(s)`, 14, statY);
      statY += 5;
    }
  });

  doc.save(`arbres_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Statistiques de production
 */
export const exportProductionPDF = (stats) => {
  const { doc, addFooter, startY } = createBasePDF(
    'Rapport de Production',
    `PÃ©riode : ${new Date().getFullYear()}`
  );

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Production par Parcelle', 14, startY);

  const parcelleData = stats.parcelles.map(p => [
    p.nom_parcelle,
    `${p.annee}`,
    `${(p.poids_total_g / 1000).toFixed(2)} kg`,
    `${parseFloat(p.valeur_totale || 0).toFixed(2)} â‚¬`,
    `${parseFloat(p.prix_moyen_kg || 0).toFixed(2)} â‚¬/kg`
  ]);

  doc.autoTable({
    startY: startY + 5,
    head: [['Parcelle', 'AnnÃ©e', 'Production', 'Valeur', 'Prix moyen']],
    body: parcelleData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    },
    didDrawPage: addFooter
  });

  const currentY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 10 Arbres Producteurs', 14, currentY);

  const top10Arbres = stats.arbres
    .sort((a, b) => b.poids_total_g - a.poids_total_g)
    .slice(0, 10);

  const arbreData = top10Arbres.map((a, index) => [
    `${index + 1}`,
    a.numero_arbre,
    a.espece,
    `${(a.poids_total_g / 1000).toFixed(2)} kg`,
    `${a.nombre_recoltes || 0} rÃ©colte(s)`
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [['Rang', 'Arbre', 'EspÃ¨ce', 'Production', 'RÃ©coltes']],
    body: arbreData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right' },
      4: { halign: 'center' }
    },
    didDrawPage: addFooter
  });

  doc.save(`production_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des interventions
 */
export const exportInterventionsPDF = (interventions, filterStatut = 'all') => {
  const filteredInterventions = filterStatut === 'all' 
    ? interventions 
    : interventions.filter(i => i.statut === filterStatut);

  const { doc, addFooter, startY } = createBasePDF(
    'Rapport des Interventions',
    `${filterStatut === 'all' ? 'Toutes' : filterStatut} - Total : ${filteredInterventions.length}`
  );

  const tableData = filteredInterventions.map(i => [
    new Date(i.date_prevue).toLocaleDateString('fr-FR'),
    i.type_nom || '-',
    i.parcelle_nom || '-',
    i.arbre_numero || '-',
    i.statut,
    i.personnel || '-',
    i.cout ? `${parseFloat(i.cout).toFixed(2)} â‚¬` : '-'
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Date', 'Type', 'Parcelle', 'Arbre', 'Statut', 'Personnel', 'CoÃ»t']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const stats = {
    planifie: filteredInterventions.filter(i => i.statut === 'PlanifiÃ©').length,
    enCours: filteredInterventions.filter(i => i.statut === 'En cours').length,
    termine: filteredInterventions.filter(i => i.statut === 'TerminÃ©').length,
    annule: filteredInterventions.filter(i => i.statut === 'AnnulÃ©').length,
    coutTotal: filteredInterventions.reduce((sum, i) => sum + parseFloat(i.cout || 0), 0)
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, finalY - 5, 180, 35, 'F');
  
  doc.text('RÃ©sumÃ© des Interventions', 104, finalY, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`  â€¢ PlanifiÃ© : ${stats.planifie}`, 20, finalY + 8);
  doc.text(`  â€¢ En cours : ${stats.enCours}`, 20, finalY + 15);
  doc.text(`  â€¢ TerminÃ© : ${stats.termine}`, 20, finalY + 22);
  doc.text(`  â€¢ AnnulÃ© : ${stats.annule}`, 120, finalY + 8);
  doc.text(`  â€¢ CoÃ»t total : ${stats.coutTotal.toFixed(2)} â‚¬`, 120, finalY + 15);

  doc.save(`interventions_${filterStatut}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Rapport de rÃ©coltes
 */
export const exportRecoltesPDF = (recoltes, annee = null) => {
  const filteredRecoltes = annee
    ? recoltes.filter(r => new Date(r.date_recolte).getFullYear() === annee)
    : recoltes;

  const { doc, addFooter, startY } = createBasePDF(
    'Rapport des RÃ©coltes',
    annee ? `AnnÃ©e ${annee} - ${filteredRecoltes.length} rÃ©colte(s)` : `Total : ${filteredRecoltes.length} rÃ©colte(s)`
  );

  const tableData = filteredRecoltes.map(r => [
    new Date(r.date_recolte).toLocaleDateString('fr-FR'),
    r.parcelle_nom || '-',
    r.arbre_numero || '-',
    `${r.poids_grammes} g`,
    r.qualite || '-',
    r.calibre || '-',
    r.notes ? 'âœ“' : ''
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Date', 'Parcelle', 'Arbre', 'Poids', 'Qualité', 'Calibre', 'Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 25 },
      3: { halign: 'right' },
      6: { halign: 'center', cellWidth: 15 }
    },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const totalPoids = filteredRecoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0);
  const avgQuality = filteredRecoltes.filter(r => r.qualite).length;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RÃ©sumÃ© :', 14, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`  â€¢ Poids total : ${(totalPoids / 1000).toFixed(2)} kg`, 14, finalY + 7);
  doc.text(`  â€¢ Poids moyen par rÃ©colte : ${(totalPoids / filteredRecoltes.length / 1000).toFixed(2)} kg`, 14, finalY + 14);
  doc.text(`  â€¢ RÃ©coltes avec qualitÃ© renseignÃ©e : ${avgQuality}/${filteredRecoltes.length}`, 14, finalY + 21);

  doc.save(`recoltes_${annee || 'toutes'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des clients
 */
export const exportClientsPDF = (clients) => {
  const { doc, addFooter, startY } = createBasePDF(
    'Liste des Clients',
    `Total : ${clients.length} client(s)`
  );

  const tableData = clients.map(c => [
    c.type === 'particulier' ? c.nom + ' ' + (c.prenom || '') : c.raison_sociale,
    c.type === 'particulier' ? 'Particulier' : 'Professionnel',
    c.email || '-',
    c.telephone || '-',
    c.ville || '-',
    c.date_premier_achat ? new Date(c.date_premier_achat).toLocaleDateString('fr-FR') : '-'
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Nom', 'Type', 'Email', 'TÃ©lÃ©phone', 'Ville', '1er achat']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 45 },
      3: { cellWidth: 30 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25, halign: 'center' }
    },
    didDrawPage: addFooter
  });

  doc.save(`clients_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des ventes
 */
export const exportVentesPDF = (ventes, annee = null) => {
  const filteredVentes = annee
    ? ventes.filter(v => new Date(v.date_vente).getFullYear() === annee)
    : ventes;

  const { doc, addFooter, startY } = createBasePDF(
    'Rapport des Ventes',
    annee ? `AnnÃ©e ${annee} - ${filteredVentes.length} vente(s)` : `Total : ${filteredVentes.length} vente(s)`
  );

  const tableData = filteredVentes.map(v => [
    new Date(v.date_vente).toLocaleDateString('fr-FR'),
    v.client_nom || '-',
    `${v.quantite_grammes ? (parseFloat(v.quantite_grammes) / 1000).toFixed(2) : '0'} kg`,
    v.prix_unitaire_kg ? `${v.prix_unitaire_kg} â‚¬/kg` : '-',
    v.montant_total ? `${parseFloat(v.montant_total).toFixed(2)} â‚¬` : '-',
    v.mode_paiement || '-',
    v.statut || '-'
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Date', 'Client', 'QuantitÃ©', 'Prix/kg', 'Montant', 'Paiement', 'Statut']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 25 },
      6: { cellWidth: 25, halign: 'center' }
    },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const totalQuantite = filteredVentes.reduce((sum, v) => sum + parseFloat(v.quantite_grammes || 0), 0);
  const totalMontant = filteredVentes.reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0);
  const prixMoyen = totalQuantite > 0 ? (totalMontant / (totalQuantite / 1000)) : 0;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, finalY - 5, 180, 35, 'F');
  
  doc.text('RÃ©sumÃ© des Ventes', 104, finalY, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`  â€¢ QuantitÃ© totale : ${(totalQuantite / 1000).toFixed(2)} kg`, 20, finalY + 8);
  doc.text(`  â€¢ Chiffre d'affaires : ${totalMontant.toFixed(2)} â‚¬`, 20, finalY + 15);
  doc.text(`  â€¢ Prix moyen : ${prixMoyen.toFixed(2)} â‚¬/kg`, 20, finalY + 22);
  doc.text(`  â€¢ Nombre de ventes : ${filteredVentes.length}`, 120, finalY + 8);
  doc.text(`  â€¢ Vente moyenne : ${(totalMontant / filteredVentes.length).toFixed(2)} â‚¬`, 120, finalY + 15);

  doc.save(`ventes_${annee || 'toutes'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des commandes
 */
export const exportCommandesPDF = (commandes, clients) => {
  const { doc, addFooter, startY } = createBasePDF(
    'Liste des Commandes',
    `Total : ${commandes.length} commande(s)`
  );

  const tableData = commandes.map(c => {
    const client = clients.find(cl => cl.id === c.client_id);
    const clientNom = client 
      ? (client.type === 'Particulier' 
          ? `${client.nom} ${client.prenom || ''}`
          : client.raison_sociale || client.nom)
      : '-';
    
    return [
      c.numero_commande || `CMD-${c.id}`,
      new Date(c.date_commande).toLocaleDateString('fr-FR'),
      clientNom,
      c.date_livraison_demandee ? new Date(c.date_livraison_demandee).toLocaleDateString('fr-FR') : '-',
      `${parseFloat(c.poids_grammes || 0).toFixed(0)} g`,
      c.calibre || '-',
      c.qualite || '-',
      `${parseFloat(c.montant_total || 0).toFixed(2)} â‚¬`,
      c.statut || '-'
    ];
  });

  doc.autoTable({
    startY: startY,
    head: [['NÂ° Commande', 'Date', 'Client', 'Livraison', 'Poids', 'Calibre', 'QualitÃ©', 'Montant', 'Statut']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 20 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 22, halign: 'center' }
    },
    didDrawPage: addFooter
  });

  // Statistiques
  const finalY = doc.lastAutoTable.finalY + 10;
  const stats = {
    enAttente: commandes.filter(c => c.statut === 'En attente').length,
    confirmees: commandes.filter(c => c.statut === 'ConfirmÃ©e').length,
    enPreparation: commandes.filter(c => c.statut === 'En prÃ©paration').length,
    livrees: commandes.filter(c => c.statut === 'LivrÃ©e').length,
    annulees: commandes.filter(c => c.statut === 'AnnulÃ©e').length,
    poidsTotal: commandes.filter(c => c.statut !== 'AnnulÃ©e').reduce((sum, c) => sum + parseFloat(c.poids_grammes || 0), 0),
    montantTotal: commandes.filter(c => c.statut !== 'AnnulÃ©e').reduce((sum, c) => sum + parseFloat(c.montant_total || 0), 0)
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, finalY - 5, 180, 40, 'F');
  
  doc.text('RÃ©sumÃ© des Commandes', 104, finalY, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`  â€¢ En attente : ${stats.enAttente}`, 20, finalY + 8);
  doc.text(`  â€¢ ConfirmÃ©es : ${stats.confirmees}`, 20, finalY + 15);
  doc.text(`  â€¢ En prÃ©paration : ${stats.enPreparation}`, 20, finalY + 22);
  doc.text(`  â€¢ LivrÃ©es : ${stats.livrees}`, 20, finalY + 29);
  doc.text(`  â€¢ Poids total commandÃ© : ${(stats.poidsTotal / 1000).toFixed(2)} kg`, 100, finalY + 8);
  doc.text(`  â€¢ Montant total : ${stats.montantTotal.toFixed(2)} â‚¬`, 100, finalY + 15);
  doc.text(`  â€¢ AnnulÃ©es : ${stats.annulees}`, 100, finalY + 22);

  doc.save(`commandes_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : DÃ©tail d'une commande (bon de commande)
 */
export const exportCommandeDetailPDF = (commande, client) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // En-tÃªte
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BON DE COMMANDE', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(commande.numero_commande || `CMD-${commande.id}`, pageWidth / 2, 28, { align: 'center' });

  // Infos commande
  doc.setTextColor(COLORS.text);
  doc.setFontSize(10);
  let currentY = 45;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Date de commande :', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(commande.date_commande).toLocaleDateString('fr-FR'), 60, currentY);
  
  if (commande.date_livraison_demandee) {
    currentY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Livraison souhaitÃ©e :', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(commande.date_livraison_demandee).toLocaleDateString('fr-FR'), 60, currentY);
  }

  // Statut
  currentY += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Statut :', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(commande.statut || 'En attente', 60, currentY);

  // Client
  currentY += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('Client', 18, currentY + 2);
  
  currentY += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (client) {
    const clientNom = client.type === 'Particulier' 
      ? `${client.nom} ${client.prenom || ''}`
      : client.raison_sociale || client.nom;
    doc.text(clientNom, 14, currentY);
    
    if (client.adresse) {
      currentY += 6;
      doc.text(client.adresse, 14, currentY);
    }
    if (client.code_postal || client.ville) {
      currentY += 6;
      doc.text(`${client.code_postal || ''} ${client.ville || ''}`, 14, currentY);
    }
    if (client.telephone) {
      currentY += 6;
      doc.text(`TÃ©l : ${client.telephone}`, 14, currentY);
    }
    if (client.email) {
      currentY += 6;
      doc.text(`Email : ${client.email}`, 14, currentY);
    }
  } else {
    doc.text('Client non spÃ©cifiÃ©', 14, currentY);
  }

  // DÃ©tails produit
  currentY += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('DÃ©tails de la commande', 18, currentY + 2);

  currentY += 12;
  
  const produitData = [
    ['Poids demandÃ©', `${parseFloat(commande.poids_grammes || 0).toFixed(0)} g (${(parseFloat(commande.poids_grammes || 0) / 1000).toFixed(2)} kg)`],
    ['Calibre', commande.calibre || 'Non spÃ©cifiÃ©'],
    ['QualitÃ©', commande.qualite || 'Non spÃ©cifiÃ©e'],
    ['MaturitÃ©', commande.maturite || 'Non spÃ©cifiÃ©e']
  ];

  doc.autoTable({
    startY: currentY,
    body: produitData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 130 }
    }
  });

  // Tarification
  currentY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('Tarification', 18, currentY + 2);

  currentY += 12;

  const prixData = [
    ['Prix unitaire', commande.prix_unitaire_kg ? `${parseFloat(commande.prix_unitaire_kg).toFixed(2)} â‚¬/kg` : 'Non dÃ©fini'],
  ];

  doc.autoTable({
    startY: currentY,
    body: prixData,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 130 }
    }
  });

  // Montant total
  currentY = doc.lastAutoTable.finalY + 5;
  doc.setFillColor(COLORS.primary);
  doc.rect(100, currentY, 94, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL :', 105, currentY + 10);
  doc.text(`${parseFloat(commande.montant_total || 0).toFixed(2)} â‚¬`, 188, currentY + 10, { align: 'right' });

  // Notes
  if (commande.notes) {
    currentY += 25;
    doc.setTextColor(COLORS.text);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes :', 14, currentY);
    
    currentY += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(commande.notes, 14, currentY, { maxWidth: 180 });
  }

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `GÃ©nÃ©rÃ© le ${new Date().toLocaleDateString('fr-FR')} Ã  ${new Date().toLocaleTimeString('fr-FR')}`,
    pageWidth / 2,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );

  doc.save(`commande_${commande.numero_commande || commande.id}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF complet : Rapport annuel
 */
export const exportRapportAnnuelPDF = (data) => {
  const { parcelles, arbres, recoltes, ventes, annee } = data;
  
  const { doc, addFooter } = createBasePDF(
    `Rapport Annuel ${annee}`,
    'Vue d\'ensemble complÃ¨te de l\'exploitation'
  );

  let currentY = 50;

  // 1. Vue d'ensemble
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.secondary);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('ðŸ“Š Vue d\'ensemble', 18, currentY + 2);
  
  currentY += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const stats = [
    `Parcelles : ${parcelles.length}`,
    `Arbres : ${arbres.length}`,
    `RÃ©coltes : ${recoltes.length}`,
    `Ventes : ${ventes.length}`,
    `Production totale : ${(recoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0) / 1000).toFixed(2)} kg`,
    `Chiffre d'affaires : ${ventes.reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0).toFixed(2)} â‚¬`
  ];

  stats.forEach(stat => {
    doc.text(`  â€¢ ${stat}`, 20, currentY);
    currentY += 7;
  });

  addFooter();
  doc.save(`rapport_annuel_${annee}.pdf`);
};

const pdfExportUtils = {
  exportParcellesPDF,
  exportArbresPDF,
  exportProductionPDF,
  exportInterventionsPDF,
  exportRecoltesPDF,
  exportClientsPDF,
  exportVentesPDF,
  exportCommandesPDF,
  exportCommandeDetailPDF,
  exportRapportAnnuelPDF
};

export default pdfExportUtils;
