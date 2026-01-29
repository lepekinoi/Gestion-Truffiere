// src/utils/pdfExport.js

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import truffeIcon from './truffeicon.png';

const COLORS = {
  primary: '#2c5f2d',
  secondary: '#97bc62',
  text: '#2c3e50',
  lightGray: '#ecf0f1',
  border: '#bdc3c7'
};

const loadImageAsBase64 = (src) =>
  new Promise((resolve, reject) => {
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

const createBasePDF = async (title, subtitle = '', withLogo = true) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');

  if (withLogo) {
    try {
      const logoBase64 = await loadImageAsBase64(truffeIcon);
      doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 55, 2, 10, 10);
      doc.text('Gestion de Truffière', pageWidth / 2 + 5, 10, { align: 'center' });
    } catch {
      doc.text('Gestion de Truffière', pageWidth / 2, 10, { align: 'center' });
    }
  } else {
    doc.text('Gestion de Truffière', pageWidth / 2, 10, { align: 'center' });
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 22, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text);
    doc.text(subtitle, 14, 38);
  }

  doc.setFontSize(9);
  doc.setTextColor(COLORS.text);
  const dateStr = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
  doc.text(dateStr, pageWidth - 14, 38, { align: 'right' });

  const addFooter = () => {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth / 2, pageHeight - 10, {
      align: 'center'
    });
  };

  return { doc, addFooter, startY: 45 };
};

// PARCELLES
export const exportParcellesPDF = async (parcelles) => {
  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport des Parcelles',
    `Total : ${parcelles.length} parcelle(s)`
  );

  const tableData = parcelles.map((p) => [
    p.nom,
    `${p.surface_ha} ha`,
    p.type_sol || '-',
    p.ph_sol ? `pH ${p.ph_sol}` : '-',
    p.date_creation ? new Date(p.date_creation).toLocaleDateString('fr-FR') : '-'
  ]);

  doc.autoTable({
    startY,
    head: [['Nom', 'Surface', 'Type de sol', 'pH', 'Date création']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 5 },
    didDrawPage: addFooter
  });

  doc.save(`parcelles_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ARBRES
export const exportArbresPDF = async (arbres, parcelleFilter = null) => {
  const filtered = parcelleFilter ? arbres.filter((a) => a.parcelle_id === parcelleFilter) : arbres;

  const { doc, addFooter, startY } = await createBasePDF(
    'Inventaire des Arbres Truffiers',
    parcelleFilter
      ? `Parcelle filtrée — Total : ${filtered.length} arbre(s)`
      : `Total : ${filtered.length} arbre(s)`
  );

  const tableData = filtered.map((a) => [
    a.numero,
    a.espece,
    a.variete_truffe || '-',
    a.parcelle_nom || '-',
    a.etat_sanitaire,
    a.date_plantation ? new Date(a.date_plantation).toLocaleDateString('fr-FR') : '-',
    a.circonference_cm ? `${a.circonference_cm} cm` : '-'
  ]);

  doc.autoTable({
    startY,
    head: [['Numéro', 'Espèce', 'Variété truffe', 'Parcelle', 'État', 'Plantation', 'Circonf.']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const stats = {
    Bon: filtered.filter((a) => a.etat_sanitaire === 'Bon').length,
    Moyen: filtered.filter((a) => a.etat_sanitaire === 'Moyen').length,
    Mauvais: filtered.filter((a) => a.etat_sanitaire === 'Mauvais').length,
    Mort: filtered.filter((a) => a.etat_sanitaire === 'Mort').length
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistiques :', 14, finalY);

  let y = finalY + 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  Object.entries(stats).forEach(([etat_sanitaire, count]) => {
    if (count > 0) {
      doc.text(`- ${etat_sanitaire} : ${count} arbre(s)`, 14, y);
      y += 5;
    }
  });

  doc.save(`arbres_${new Date().toISOString().split('T')[0]}.pdf`);
};

// PRODUCTION
export const exportProductionPDF = async (stats) => {
  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport de Production',
    `Période : ${new Date().getFullYear()}`
  );

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Production par Parcelle', 14, startY);

  const parcelleData = (stats.parcelles || []).map((p) => [
    p.nom_parcelle,
    `${p.annee}`,
    `${(p.poids_total_g / 1000).toFixed(2)} kg`,
    `${parseFloat(p.valeur_totale || 0).toFixed(2)} EUR`,
    `${parseFloat(p.prix_moyen_kg || 0).toFixed(2)} EUR/kg`
  ]);

  doc.autoTable({
    startY: startY + 5,
    head: [['Parcelle', 'Année', 'Production', 'Valeur', 'Prix moyen']],
    body: parcelleData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    didDrawPage: addFooter
  });

  const currentY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 10 Arbres Producteurs', 14, currentY);

  const top10Arbres = (stats.arbres || [])
    .slice()
    .sort((a, b) => b.poids_total_g - a.poids_total_g)
    .slice(0, 10);

  const arbreData = top10Arbres.map((a, index) => [
    `${index + 1}`,
    a.numero_arbre,
    a.espece,
    `${(a.poids_total_g / 1000).toFixed(2)} kg`,
    `${a.nombre_recoltes || 0} récolte(s)`
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [['Rang', 'Arbre', 'Espèce', 'Production', 'Récoltes']],
    body: arbreData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    didDrawPage: addFooter
  });

  doc.save(`production_${new Date().toISOString().split('T')[0]}.pdf`);
};

// INTERVENTIONS
export const exportInterventionsPDF = async (interventions, filterStatut = 'all') => {
  const filtered =
    filterStatut === 'all'
      ? interventions
      : interventions.filter((i) => i.statut === filterStatut);

  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport des Interventions',
    `${filterStatut === 'all' ? 'Toutes' : filterStatut} — Total : ${filtered.length}`
  );

  const tableData = filtered.map((i) => [
    i.date_prevue ? new Date(i.date_prevue).toLocaleDateString('fr-FR') : '-',
    i.type_nom || '-',
    i.parcelle_nom || '-',
    i.arbre_numero || '-',
    i.statut,
    i.personnel || '-',
    i.cout ? `${parseFloat(i.cout).toFixed(2)} EUR` : '-'
  ]);

  doc.autoTable({
    startY,
    head: [['Date', 'Type', 'Parcelle', 'Arbre', 'Statut', 'Personnel', 'Coût']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const statsIntervention = {
    planifie: filtered.filter((i) => i.statut === 'Planifié').length,
    enCours: filtered.filter((i) => i.statut === 'En cours').length,
    termine: filtered.filter((i) => i.statut === 'Terminé').length,
    annule: filtered.filter((i) => i.statut === 'Annulé').length,
    coutTotal: filtered.reduce((sum, i) => sum + parseFloat(i.cout || 0), 0)
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, finalY - 5, 180, 35, 'F');

  doc.text('Résumé des Interventions', 104, finalY, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`- Planifié : ${statsIntervention.planifie}`, 20, finalY + 8);
  doc.text(`- En cours : ${statsIntervention.enCours}`, 20, finalY + 15);
  doc.text(`- Terminé : ${statsIntervention.termine}`, 20, finalY + 22);
  doc.text(`- Annulé : ${statsIntervention.annule}`, 120, finalY + 8);
  doc.text(`- Coût total : ${statsIntervention.coutTotal.toFixed(2)} EUR`, 120, finalY + 15);

  doc.save(`interventions_${filterStatut}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// RÉCOLTES
export const exportRecoltesPDF = async (recoltes, annee = null) => {
  const filtered = annee
    ? recoltes.filter((r) => new Date(r.date_recolte).getFullYear() === annee)
    : recoltes;

  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport des Récoltes',
    annee
      ? `Année ${annee} — ${filtered.length} récolte(s)`
      : `Total : ${filtered.length} récolte(s)`
  );

  const tableData = filtered.map((r) => [
    r.date_recolte ? new Date(r.date_recolte).toLocaleDateString('fr-FR') : '-',
    r.parcelle_nom || '-',
    r.arbre_numero || '-',
    `${r.poids_grammes || 0} g`,
    r.qualite || '-',
    r.calibre || '-',
    r.notes ? 'Oui' : ''
  ]);

  doc.autoTable({
    startY,
    head: [['Date', 'Parcelle', 'Arbre', 'Poids', 'Qualité', 'Calibre', 'Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const totalPoids = filtered.reduce(
    (sum, r) => sum + parseFloat(r.poids_grammes || 0),
    0
  );

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Résumé :', 14, finalY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`- Poids total : ${(totalPoids / 1000).toFixed(2)} kg`, 14, finalY + 7);
  if (filtered.length > 0) {
    doc.text(
      `- Poids moyen par récolte : ${(totalPoids / filtered.length / 1000).toFixed(2)} kg`,
      14,
      finalY + 14
    );
  }

  doc.save(`recoltes_${annee || 'toutes'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// CLIENTS
export const exportClientsPDF = async (clients, colonnesExport = null) => {
  const { doc, addFooter, startY } = await createBasePDF(
    'Liste des Clients',
    `Total : ${clients.length} client(s)`
  );

  const defaultCols = ['nom', 'type', 'email', 'telephone', 'ville', 'date_premier_achat'];
  const cols = colonnesExport && colonnesExport.length > 0 ? colonnesExport : defaultCols;

  const colConfig = {
    nom: {
      label: 'Nom',
      render: (c) =>
        c.type === 'Particulier'
          ? `${c.nom} ${c.prenom || ''}`.trim()
          : c.raison_sociale || c.nom
    },
    prenom: { label: 'Prénom', render: (c) => c.prenom || '-' },
    raison_sociale: { label: 'Raison sociale', render: (c) => c.raison_sociale || '-' },
    type: { label: 'Type', render: (c) => c.type || '-' },
    email: { label: 'Email', render: (c) => c.email || '-' },
    telephone: { label: 'Tél.', render: (c) => c.telephone || '-' },
    adresse: { label: 'Adresse', render: (c) => c.adresse || '-' },
    code_postal: { label: 'CP', render: (c) => c.code_postal || '-' },
    ville: { label: 'Ville', render: (c) => c.ville || '-' },
    pays: { label: 'Pays', render: (c) => c.pays || '-' },
    siret: { label: 'SIRET', render: (c) => c.siret || '-' },
    date_premier_achat: {
      label: '1er achat',
      render: (c) =>
        c.date_premier_achat
          ? new Date(c.date_premier_achat).toLocaleDateString('fr-FR')
          : '-'
    },
    notes: { label: 'Notes', render: (c) => c.notes || '-' }
  };

  const validCols = cols.filter((col) => colConfig[col]);
  const headers = validCols.map((col) => colConfig[col].label);
  const tableData = clients.map((c) => validCols.map((col) => colConfig[col].render(c)));

  doc.autoTable({
    startY,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    didDrawPage: addFooter
  });

  doc.save(`clients_${new Date().toISOString().split('T')[0]}.pdf`);
};

// VENTES
export const exportVentesPDF = async (ventes, clients = [], colonnesExport = null, annee = null) => {
  const filtered = annee
    ? ventes.filter((v) => new Date(v.date_vente).getFullYear() === annee)
    : ventes;

  const { doc, addFooter, startY } = await createBasePDF(
    'Rapport des Ventes',
    annee
      ? `Année ${annee} — ${filtered.length} vente(s)`
      : `Total : ${filtered.length} vente(s)`
  );

  const defaultCols = [
    'date_vente',
    'client_nom',
    'quantite_grammes',
    'prix_unitaire_kg',
    'montant_total',
    'mode_paiement',
    'statut'
  ];
  const cols = colonnesExport && colonnesExport.length > 0 ? colonnesExport : defaultCols;

  const getClientName = (v) => {
    if (v.client_nom) return v.client_nom;
    const client = clients.find((c) => c.id === v.client_id);
    if (!client) return '-';
    return client.type === 'Particulier'
      ? `${client.nom} ${client.prenom || ''}`.trim()
      : client.raison_sociale || client.nom;
  };

  const colConfig = {
    date_vente: {
      label: 'Date',
      render: (v) =>
        v.date_vente ? new Date(v.date_vente).toLocaleDateString('fr-FR') : '-'
    },
    numero_facture: { label: 'N° Facture', render: (v) => v.numero_facture || '-' },
    client_nom: { label: 'Client', render: (v) => getClientName(v) },
    quantite_grammes: {
      label: 'Qté',
      render: (v) =>
        v.quantite_grammes
          ? `${(parseFloat(v.quantite_grammes) / 1000).toFixed(2)} kg`
          : '-'
    },
    prix_unitaire_kg: {
      label: 'Prix/kg',
      render: (v) =>
        v.prix_unitaire_kg ? `${parseFloat(v.prix_unitaire_kg).toFixed(0)} €` : '-'
    },
    montant_total: {
      label: 'Montant',
      render: (v) => `${parseFloat(v.montant_total || 0).toFixed(2)} €`
    },
    mode_paiement: { label: 'Paiement', render: (v) => v.mode_paiement || '-' },
    statut: { label: 'Statut', render: (v) => v.statut || '-' },
    commande_numero: {
      label: 'Cmd',
      render: (v) => v.commande_numero || (v.commande_id ? `#${v.commande_id}` : '-')
    },
    notes: { label: 'Notes', render: (v) => v.notes || '-' }
  };

  const validCols = cols.filter((col) => colConfig[col]);
  const headers = validCols.map((col) => colConfig[col].label);
  const tableData = filtered.map((v) => validCols.map((col) => colConfig[col].render(v)));

  doc.autoTable({
    startY,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    didDrawPage: addFooter
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const totalQuantite = filtered.reduce(
    (sum, v) => sum + parseFloat(v.quantite_grammes || 0),
    0
  );
  const totalMontant = filtered.reduce(
    (sum, v) => sum + parseFloat(v.montant_total || 0),
    0
  );
  const prixMoyen = totalQuantite > 0 ? totalMontant / (totalQuantite / 1000) : 0;

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
  doc.text(`- Nombre de ventes : ${filtered.length}`, 120, finalY + 8);
  doc.text(
    `- Vente moyenne : ${
      filtered.length > 0 ? (totalMontant / filtered.length).toFixed(2) : '0.00'
    } EUR`,
    120,
    finalY + 15
  );

  doc.save(`ventes_${annee || 'toutes'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// COMMANDES — LISTE
export const exportCommandesPDF = async (commandes, clients) => {
  const { doc, addFooter, startY } = await createBasePDF(
    'Liste des Commandes',
    `Total : ${commandes.length} commande(s)`
  );

  const tableData = commandes.map((c) => {
    const client = clients.find((cl) => cl.id === c.client_id);
    const clientNom = client
      ? client.type === 'Particulier'
        ? `${client.nom} ${client.prenom || ''}`
        : client.raison_sociale || client.nom
      : '-';

    return [
      c.numero_commande || `CMD-${c.id}`,
      c.date_commande ? new Date(c.date_commande).toLocaleDateString('fr-FR') : '-',
      clientNom,
      c.date_livraison_demandee
        ? new Date(c.date_livraison_demandee).toLocaleDateString('fr-FR')
        : '-',
      `${parseFloat(c.poids_grammes || 0).toFixed(0)} g`,
      c.calibre || '-',
      c.qualite || '-',
      `${parseFloat(c.montant_total || 0).toFixed(2)} EUR`,
      c.statut || '-'
    ];
  });

  doc.autoTable({
    startY,
    head: [
      [
        'N° Commande',
        'Date',
        'Client',
        'Livraison',
        'Poids',
        'Calibre',
        'Qualité',
        'Montant',
        'Statut'
      ]
    ],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
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

  const finalY = doc.lastAutoTable.finalY + 10;
  const statsCommande = {
    enAttente: commandes.filter((c) => c.statut === 'En attente').length,
    confirmees: commandes.filter((c) => c.statut === 'Confirmée').length,
    enPreparation: commandes.filter((c) => c.statut === 'En préparation').length,
    livrees: commandes.filter((c) => c.statut === 'Livrée').length,
    annulees: commandes.filter((c) => c.statut === 'Annulée').length,
    poidsTotal: commandes
      .filter((c) => c.statut !== 'Annulée')
      .reduce((sum, c) => sum + parseFloat(c.poids_grammes || 0), 0),
    montantTotal: commandes
      .filter((c) => c.statut !== 'Annulée')
      .reduce((sum, c) => sum + parseFloat(c.montant_total || 0), 0)
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, finalY - 5, 180, 40, 'F');

  doc.text('Résumé des Commandes', 104, finalY, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`- En attente : ${statsCommande.enAttente}`, 20, finalY + 8);
  doc.text(`- Confirmées : ${statsCommande.confirmees}`, 20, finalY + 15);
  doc.text(`- En préparation : ${statsCommande.enPreparation}`, 20, finalY + 22);
  doc.text(`- Livrées : ${statsCommande.livrees}`, 20, finalY + 29);
  doc.text(
    `- Poids total commande : ${(statsCommande.poidsTotal / 1000).toFixed(2)} kg`,
    100,
    finalY + 8
  );
  doc.text(
    `- Montant total : ${statsCommande.montantTotal.toFixed(2)} EUR`,
    100,
    finalY + 15
  );
  doc.text(`- Annulées : ${statsCommande.annulees}`, 100, finalY + 22);

  doc.save(`commandes_${new Date().toISOString().split('T')[0]}.pdf`);
};

// COMMANDES — DÉTAIL
export const exportCommandeDetailPDF = async (commande, client) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');

  try {
    const logoBase64 = await loadImageAsBase64(truffeIcon);
    doc.addImage(logoBase64, 'PNG', 14, 5, 12, 12);
  } catch {}

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BON DE COMMANDE', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(commande.numero_commande || `CMD-${commande.id}`, pageWidth / 2, 28, {
    align: 'center'
  });

  doc.setTextColor(COLORS.text);
  doc.setFontSize(10);
  let currentY = 45;

  doc.setFont('helvetica', 'bold');
  doc.text('Date de commande :', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(
    commande.date_commande
      ? new Date(commande.date_commande).toLocaleDateString('fr-FR')
      : '-',
    60,
    currentY
  );

  if (commande.date_livraison_demandee) {
    currentY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Livraison souhaitée :', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(
      new Date(commande.date_livraison_demandee).toLocaleDateString('fr-FR'),
      60,
      currentY
    );
  }

  currentY += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Statut :', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(commande.statut || 'En attente', 60, currentY);

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
    const clientNom =
      client.type === 'Particulier'
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
    doc.text('Client non spécifié', 14, currentY);
  }

  currentY += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('Détails de la commande', 18, currentY + 2);

  currentY += 12;

  const produitData = [
    [
      'Poids demandé',
      `${parseFloat(commande.poids_grammes || 0).toFixed(0)} g (${(
        parseFloat(commande.poids_grammes || 0) / 1000
      ).toFixed(2)} kg)`
    ],
    ['Calibre', commande.calibre || 'Non spécifié'],
    ['Qualité', commande.qualite || 'Non spécifiée'],
    ['Maturité', commande.maturite || 'Non spécifiée']
  ];

  doc.autoTable({
    startY: currentY,
    body: produitData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 130 }
    }
  });

  currentY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.lightGray);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text('Tarification', 18, currentY + 2);

  currentY += 12;

  const prixData = [
    [
      'Prix unitaire',
      commande.prix_unitaire_kg
        ? `${parseFloat(commande.prix_unitaire_kg).toFixed(2)} EUR/kg`
        : 'Non défini'
    ]
  ];

  doc.autoTable({
    startY: currentY,
    body: prixData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 130 }
    }
  });

  currentY = doc.lastAutoTable.finalY + 5;
  doc.setFillColor(COLORS.primary);
  doc.rect(100, currentY, 94, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL :', 105, currentY + 10);
  doc.text(
    `${parseFloat(commande.montant_total || 0).toFixed(2)} EUR`,
    188,
    currentY + 10,
    { align: 'right' }
  );

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

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString(
      'fr-FR'
    )}`,
    pageWidth / 2,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );

  doc.save(
    `commande_${commande.numero_commande || commande.id}_${
      new Date().toISOString().split('T')[0]
    }.pdf`
  );
};

// RAPPORT ANNUEL
export const exportRapportAnnuelPDF = async (data) => {
  const { parcelles = [], arbres = [], recoltes = [], ventes = [], annee } = data;

  const { doc, addFooter } = await createBasePDF(
    `Rapport Annuel ${annee}`,
    "Vue d'ensemble complète de l'exploitation"
  );

  let currentY = 50;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(COLORS.secondary);
  doc.rect(14, currentY - 5, 180, 10, 'F');
  doc.text("Vue d'ensemble", 18, currentY + 2);

  currentY += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const totalPoids = recoltes.reduce(
    (sum, r) => sum + parseFloat(r.poids_grammes || 0),
    0
  );
  const totalCA = ventes.reduce(
    (sum, v) => sum + parseFloat(v.montant_total || 0),
    0
  );

  const statsAnnuel = [
    `Parcelles : ${parcelles.length}`,
    `Arbres : ${arbres.length}`,
    `Récoltes : ${recoltes.length}`,
    `Ventes : ${ventes.length}`,
    `Production totale : ${(totalPoids / 1000).toFixed(2)} kg`,
    `Chiffre d'affaires : ${totalCA.toFixed(2)} EUR`
  ];

  statsAnnuel.forEach((stat) => {
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
