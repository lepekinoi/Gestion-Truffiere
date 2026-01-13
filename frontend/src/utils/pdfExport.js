import jsPDF from 'jspdf';
import 'jspdf-autotable';
import truffeIcon from './truffeicon.png';

/**
 * Utilitaire d'export PDF pour l'application Truffiere
 */

// Configuration des couleurs du theme
const COLORS = {
  primary: '#2c5f2d',
  secondary: '#97bc62',
  text: '#2c3e50',
  lightGray: '#ecf0f1',
  border: '#bdc3c7'
};

/**
 * Fonction pour charger une image en base64
 */
const loadImageAsBase64 = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Fonction generique pour creer un PDF avec en-tete et pied de page
 */
const createBasePDF = async (title, subtitle = '', withLogo = true) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // En-tete
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  
  // Ajouter le logo si disponible
  if (withLogo) {
    try {
      const logoBase64 = await loadImageAsBase64(truffeIcon);
      doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 55, 2, 10, 10);
      doc.text('Gestion de Truffiere', pageWidth / 2 + 5, 10, { align: 'center' });
    } catch (e) {
      doc.text('Gestion de Truffiere', pageWidth / 2, 10, { align: 'center' });
    }
  } else {
    doc.text('Gestion de Truffiere', pageWidth / 2, 10, { align: 'center' });
  }
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 22, { align: 'center' });

  // Sous-titre si fourni
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text);
    doc.text(subtitle, 14, 38);
  }

  // Date de generation
  doc.setFontSize(9);
  doc.setTextColor(COLORS.text);
  const dateStr = `Genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`;
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
export const exportParcellesPDF = async (parcelles) => {
  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport des Parcelles',
    `Total : ${parcelles.length} parcelle(s)`
  );

  const tableData = parcelles.map(p => [
    p.nom,
    `${p.surface_ha} ha`,
    p.type_sol || '-',
    p.ph_sol ? `pH ${p.ph_sol}` : '-',
    new Date(p.date_creation).toLocaleDateString('fr-FR')
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Nom', 'Surface', 'Type de sol', 'pH', 'Date creation']],
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
export const exportArbresPDF = async (arbres, parcelleFilter = null) => {
  const filteredArbres = parcelleFilter 
    ? arbres.filter(a => a.parcelle_id === parcelleFilter)
    : arbres;

  const { doc, addFooter, startY } = await createBasePDF(
    'Inventaire des Arbres Truffiers',
    parcelleFilter 
      ? `Parcelle filtree - Total : ${filteredArbres.length} arbre(s)`
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
    head: [['Numero', 'Espece', 'Variete truffe', 'Parcelle', 'Etat', 'Plantation', 'Circonf.']],
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
      doc.text(`- ${etat} : ${count} arbre(s)`, 14, statY);
      statY += 5;
    }
  });

  doc.save(`arbres_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Statistiques de production
 */
export const exportProductionPDF = async (stats) => {
  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport de Production',
    `Periode : ${new Date().getFullYear()}`
  );

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Production par Parcelle', 14, startY);

  const parcelleData = stats.parcelles.map(p => [
    p.nom_parcelle,
    `${p.annee}`,
    `${(p.poids_total_g / 1000).toFixed(2)} kg`,
    `${parseFloat(p.valeur_totale || 0).toFixed(2)} EUR`,
    `${parseFloat(p.prix_moyen_kg || 0).toFixed(2)} EUR/kg`
  ]);

  doc.autoTable({
    startY: startY + 5,
    head: [['Parcelle', 'Annee', 'Production', 'Valeur', 'Prix moyen']],
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
    `${a.nombre_recoltes || 0} recolte(s)`
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [['Rang', 'Arbre', 'Espece', 'Production', 'Recoltes']],
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
export const exportInterventionsPDF = async (interventions, filterStatut = 'all') => {
  const filteredInterventions = filterStatut === 'all' 
    ? interventions 
    : interventions.filter(i => i.statut === filterStatut);

  const { doc, addFooter, startY } = await createBasePDF(
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
    i.cout ? `${parseFloat(i.cout).toFixed(2)} EUR` : '-'
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Date', 'Type', 'Parcelle', 'Arbre', 'Statut', 'Personnel', 'Cout']],
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
  const statsIntervention = {
    planifie: filteredInterventions.filter(i => i.statut === 'Planifie').length,
    enCours: filteredInterventions.filter(i => i.statut === 'En cours').length,
    termine: filteredInterventions.filter(i => i.statut === 'Termine').length,
    annule: filteredInterventions.filter(i => i.statut === 'Annule').length,
    coutTotal: filteredInterventions.reduce((sum, i) => sum + parseFloat(i.cout || 0), 0)
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, finalY - 5, 180, 35, 'F');
  
  doc.text('Resume des Interventions', 104, finalY, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`- Planifie : ${statsIntervention.planifie}`, 20, finalY + 8);
  doc.text(`- En cours : ${statsIntervention.enCours}`, 20, finalY + 15);
  doc.text(`- Termine : ${statsIntervention.termine}`, 20, finalY + 22);
  doc.text(`- Annule : ${statsIntervention.annule}`, 120, finalY + 8);
  doc.text(`- Cout total : ${statsIntervention.coutTotal.toFixed(2)} EUR`, 120, finalY + 15);

  doc.save(`interventions_${filterStatut}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Rapport de recoltes
 */
export const exportRecoltesPDF = async (recoltes, annee = null) => {
  const filteredRecoltes = annee
    ? recoltes.filter(r => new Date(r.date_recolte).getFullYear() === annee)
    : recoltes;

  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport des Recoltes',
    annee ? `Annee ${annee} - ${filteredRecoltes.length} recolte(s)` : `Total : ${filteredRecoltes.length} recolte(s)`
  );

  const tableData = filteredRecoltes.map(r => [
    new Date(r.date_recolte).toLocaleDateString('fr-FR'),
    r.parcelle_nom || '-',
    r.arbre_numero || '-',
    `${r.poids_grammes} g`,
    r.qualite || '-',
    r.calibre || '-',
    r.notes ? 'Oui' : ''
  ]);

  doc.autoTable({
    startY: startY,
    head: [['Date', 'Parcelle', 'Arbre', 'Poids', 'Qualite', 'Calibre', 'Notes']],
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
  doc.text('Resume :', 14, finalY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`- Poids total : ${(totalPoids / 1000).toFixed(2)} kg`, 14, finalY + 7);
  doc.text(`- Poids moyen par recolte : ${(totalPoids / filteredRecoltes.length / 1000).toFixed(2)} kg`, 14, finalY + 14);
  doc.text(`- Recoltes avec qualite renseignee : ${avgQuality}/${filteredRecoltes.length}`, 14, finalY + 21);

  doc.save(`recoltes_${annee || 'toutes'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des clients
 */
export const exportClientsPDF = async (clients, colonnesExport = null) => {
  const { doc, addFooter, startY } = await createBasePDF(
    'Liste des Clients',
    `Total : ${clients.length} client(s)`
  );

  // Colonnes par défaut si non spécifiées
  const defaultCols = ['nom', 'type', 'email', 'telephone', 'ville', 'date_premier_achat'];
  const cols = colonnesExport && colonnesExport.length > 0 ? colonnesExport : defaultCols;

  // Configuration des colonnes disponibles (largeurs ajustées pour tenir sur A4)
  const colConfig = {
    nom: { 
      label: 'Nom', 
      render: (c) => c.type === 'Particulier' ? `${c.nom} ${c.prenom || ''}`.trim() : (c.raison_sociale || c.nom),
      width: 'auto'
    },
    prenom: { label: 'Prénom', render: (c) => c.prenom || '-', width: 'auto' },
    raison_sociale: { label: 'Raison sociale', render: (c) => c.raison_sociale || '-', width: 'auto' },
    type: { label: 'Type', render: (c) => c.type || '-', width: 20, align: 'center' },
    email: { label: 'Email', render: (c) => c.email || '-', width: 'auto' },
    telephone: { label: 'Tél.', render: (c) => c.telephone || '-', width: 25 },
    adresse: { label: 'Adresse', render: (c) => c.adresse || '-', width: 'auto' },
    code_postal: { label: 'CP', render: (c) => c.code_postal || '-', width: 15, align: 'center' },
    ville: { label: 'Ville', render: (c) => c.ville || '-', width: 'auto' },
    pays: { label: 'Pays', render: (c) => c.pays || '-', width: 20 },
    siret: { label: 'SIRET', render: (c) => c.siret || '-', width: 30 },
    date_premier_achat: { 
      label: '1er achat', 
      render: (c) => c.date_premier_achat ? new Date(c.date_premier_achat).toLocaleDateString('fr-FR') : '-',
      width: 22, 
      align: 'center' 
    },
    notes: { label: 'Notes', render: (c) => c.notes || '-', width: 'auto' }
  };

  // Filtrer les colonnes valides
  const validCols = cols.filter(col => colConfig[col]);
  
  // En-têtes et données du tableau
  const headers = validCols.map(col => colConfig[col].label);
  const tableData = clients.map(c => validCols.map(col => colConfig[col].render(c)));

  // Styles des colonnes (laisser auto-size pour les colonnes sans width fixe)
  const columnStyles = {};
  validCols.forEach((col, index) => {
    const config = colConfig[col];
    const style = { halign: config.align || 'left' };
    if (config.width !== 'auto') {
      style.cellWidth = config.width;
    }
    columnStyles[index] = style;
  });

  doc.autoTable({
    startY: startY,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak'
    },
    columnStyles: columnStyles,
    tableWidth: 'auto',
    didDrawPage: addFooter
  });

  doc.save(`clients_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des ventes
 */
export const exportVentesPDF = async (ventes, clients = [], colonnesExport = null, annee = null) => {
  const filteredVentes = annee
    ? ventes.filter(v => new Date(v.date_vente).getFullYear() === annee)
    : ventes;

  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport des Ventes',
    annee ? `Année ${annee} - ${filteredVentes.length} vente(s)` : `Total : ${filteredVentes.length} vente(s)`
  );

  // Colonnes par défaut si non spécifiées
  const defaultCols = ['date_vente', 'client_nom', 'quantite_grammes', 'prix_unitaire_kg', 'montant_total', 'mode_paiement', 'statut'];
  const cols = colonnesExport && colonnesExport.length > 0 ? colonnesExport : defaultCols;

  // Fonction pour récupérer le nom du client
  const getClientName = (v) => {
    if (v.client_nom) return v.client_nom;
    const client = clients.find(c => c.id === v.client_id);
    if (client) {
      return client.type === 'Particulier' 
        ? `${client.nom} ${client.prenom || ''}`.trim()
        : (client.raison_sociale || client.nom);
    }
    return '-';
  };

  // Configuration des colonnes disponibles (largeurs ajustées)
  const colConfig = {
    date_vente: { 
      label: 'Date', 
      render: (v) => new Date(v.date_vente).toLocaleDateString('fr-FR'),
      width: 22, 
      align: 'center' 
    },
    numero_facture: { label: 'N° Facture', render: (v) => v.numero_facture || '-', width: 'auto' },
    client_nom: { label: 'Client', render: (v) => getClientName(v), width: 'auto' },
    quantite_grammes: { 
      label: 'Qté', 
      render: (v) => v.quantite_grammes ? `${(parseFloat(v.quantite_grammes) / 1000).toFixed(2)} kg` : '-',
      width: 18, 
      align: 'right' 
    },
    prix_unitaire_kg: { 
      label: 'Prix/kg', 
      render: (v) => v.prix_unitaire_kg ? `${parseFloat(v.prix_unitaire_kg).toFixed(0)} €` : '-',
      width: 18, 
      align: 'right' 
    },
    montant_total: { 
      label: 'Montant', 
      render: (v) => `${parseFloat(v.montant_total || 0).toFixed(2)} €`,
      width: 22, 
      align: 'right' 
    },
    mode_paiement: { label: 'Paiement', render: (v) => v.mode_paiement || '-', width: 22 },
    statut: { label: 'Statut', render: (v) => v.statut || '-', width: 20, align: 'center' },
    commande_numero: { 
      label: 'Cmd', 
      render: (v) => v.commande_numero || (v.commande_id ? `#${v.commande_id}` : '-'),
      width: 18 
    },
    notes: { label: 'Notes', render: (v) => v.notes || '-', width: 'auto' }
  };

  // Filtrer les colonnes valides
  const validCols = cols.filter(col => colConfig[col]);
  
  // En-têtes et données du tableau
  const headers = validCols.map(col => colConfig[col].label);
  const tableData = filteredVentes.map(v => validCols.map(col => colConfig[col].render(v)));

  // Styles des colonnes (laisser auto-size pour les colonnes sans width fixe)
  const columnStyles = {};
  validCols.forEach((col, index) => {
    const config = colConfig[col];
    const style = { halign: config.align || 'left' };
    if (config.width !== 'auto') {
      style.cellWidth = config.width;
    }
    if (col === 'montant_total') {
      style.fontStyle = 'bold';
    }
    columnStyles[index] = style;
  });

  doc.autoTable({
    startY: startY,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak'
    },
    columnStyles: columnStyles,
    tableWidth: 'auto',
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
  
  doc.text('Résumé des Ventes', 104, finalY, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`- Quantité totale : ${(totalQuantite / 1000).toFixed(2)} kg`, 20, finalY + 8);
  doc.text(`- Chiffre d'affaires : ${totalMontant.toFixed(2)} EUR`, 20, finalY + 15);
  doc.text(`- Prix moyen : ${prixMoyen.toFixed(2)} EUR/kg`, 20, finalY + 22);
  doc.text(`- Nombre de ventes : ${filteredVentes.length}`, 120, finalY + 8);
  doc.text(`- Vente moyenne : ${filteredVentes.length > 0 ? (totalMontant / filteredVentes.length).toFixed(2) : '0.00'} EUR`, 120, finalY + 15);

  doc.save(`ventes_${annee || 'toutes'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Liste des commandes
 */
export const exportCommandesPDF = async (commandes, clients) => {
  const { doc, addFooter, startY } = await createBasePDF(
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
      `${parseFloat(c.montant_total || 0).toFixed(2)} EUR`,
      c.statut || '-'
    ];
  });

  doc.autoTable({
    startY: startY,
    head: [['N. Commande', 'Date', 'Client', 'Livraison', 'Poids', 'Calibre', 'Qualite', 'Montant', 'Statut']],
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
  const statsCommande = {
    enAttente: commandes.filter(c => c.statut === 'En attente').length,
    confirmees: commandes.filter(c => c.statut === 'Confirmee').length,
    enPreparation: commandes.filter(c => c.statut === 'En preparation').length,
    livrees: commandes.filter(c => c.statut === 'Livree').length,
    annulees: commandes.filter(c => c.statut === 'Annulee').length,
    poidsTotal: commandes.filter(c => c.statut !== 'Annulee').reduce((sum, c) => sum + parseFloat(c.poids_grammes || 0), 0),
    montantTotal: commandes.filter(c => c.statut !== 'Annulee').reduce((sum, c) => sum + parseFloat(c.montant_total || 0), 0)
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, finalY - 5, 180, 40, 'F');
  
  doc.text('Resume des Commandes', 104, finalY, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`- En attente : ${statsCommande.enAttente}`, 20, finalY + 8);
  doc.text(`- Confirmees : ${statsCommande.confirmees}`, 20, finalY + 15);
  doc.text(`- En preparation : ${statsCommande.enPreparation}`, 20, finalY + 22);
  doc.text(`- Livrees : ${statsCommande.livrees}`, 20, finalY + 29);
  doc.text(`- Poids total commande : ${(statsCommande.poidsTotal / 1000).toFixed(2)} kg`, 100, finalY + 8);
  doc.text(`- Montant total : ${statsCommande.montantTotal.toFixed(2)} EUR`, 100, finalY + 15);
  doc.text(`- Annulees : ${statsCommande.annulees}`, 100, finalY + 22);

  doc.save(`commandes_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF : Detail d'une commande (bon de commande)
 */
export const exportCommandeDetailPDF = async (commande, client) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // En-tete
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Ajouter le logo
  try {
    const logoBase64 = await loadImageAsBase64(truffeIcon);
    doc.addImage(logoBase64, 'PNG', 14, 5, 12, 12);
  } catch (e) {
    // Continuer sans logo
  }
  
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
    doc.text('Livraison souhaitee :', 14, currentY);
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
      doc.text(`Tel : ${client.telephone}`, 14, currentY);
    }
    if (client.email) {
      currentY += 6;
      doc.text(`Email : ${client.email}`, 14, currentY);
    }
  } else {
    doc.text('Client non specifie', 14, currentY);
  }

  // Details produit
  currentY += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('Details de la commande', 18, currentY + 2);

  currentY += 12;
  
  const produitData = [
    ['Poids demande', `${parseFloat(commande.poids_grammes || 0).toFixed(0)} g (${(parseFloat(commande.poids_grammes || 0) / 1000).toFixed(2)} kg)`],
    ['Calibre', commande.calibre || 'Non specifie'],
    ['Qualite', commande.qualite || 'Non specifiee'],
    ['Maturite', commande.maturite || 'Non specifiee']
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
    ['Prix unitaire', commande.prix_unitaire_kg ? `${parseFloat(commande.prix_unitaire_kg).toFixed(2)} EUR/kg` : 'Non defini'],
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
  doc.text(`${parseFloat(commande.montant_total || 0).toFixed(2)} EUR`, 188, currentY + 10, { align: 'right' });

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
    `Genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`,
    pageWidth / 2,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );

  doc.save(`commande_${commande.numero_commande || commande.id}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export PDF complet : Rapport annuel
 */
export const exportRapportAnnuelPDF = async (data) => {
  const { parcelles, arbres, recoltes, ventes, annee } = data;
  
  const { doc, addFooter } = await createBasePDF(
    `Rapport Annuel ${annee}`,
    'Vue d\'ensemble complete de l\'exploitation'
  );

  let currentY = 50;

  // 1. Vue d'ensemble
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.secondary);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('Vue d\'ensemble', 18, currentY + 2);
  
  currentY += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const statsAnnuel = [
    `Parcelles : ${parcelles.length}`,
    `Arbres : ${arbres.length}`,
    `Recoltes : ${recoltes.length}`,
    `Ventes : ${ventes.length}`,
    `Production totale : ${(recoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0) / 1000).toFixed(2)} kg`,
    `Chiffre d'affaires : ${ventes.reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0).toFixed(2)} EUR`
  ];

  statsAnnuel.forEach(stat => {
    doc.text(`- ${stat}`, 20, currentY);
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
