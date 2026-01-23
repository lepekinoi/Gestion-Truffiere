// ============================================================================
// Backend - Routes Express pour les Achats de Truffes
// Configuration complète des endpoints API
// ============================================================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import FournisseurTruffesController from '../controllers/fournisseurs.controller';
import CommandeAchatController from '../controllers/commandes_achat.controller';
import { stockController, analytiqueController } from '../controllers/stock_analytique.controller';

const router = Router();

// Middleware d'authentification pour toutes les routes
router.use(authMiddleware);

// ============================================================================
// ROUTES FOURNISSEURS TRUFFES
// ============================================================================

// GET /api/v1/fournisseurs-truffes - Liste tous les fournisseurs
router.get('/fournisseurs-truffes', 
  FournisseurTruffesController.getAllFournisseurs.bind(FournisseurTruffesController)
);

// POST /api/v1/fournisseurs-truffes - Crée un nouveau fournisseur
router.post('/fournisseurs-truffes',
  FournisseurTruffesController.createFournisseur.bind(FournisseurTruffesController)
);

// GET /api/v1/fournisseurs-truffes/:id - Détails d'un fournisseur
router.get('/fournisseurs-truffes/:id',
  FournisseurTruffesController.getFournisseur.bind(FournisseurTruffesController)
);

// PUT /api/v1/fournisseurs-truffes/:id - Met à jour un fournisseur
router.put('/fournisseurs-truffes/:id',
  FournisseurTruffesController.updateFournisseur.bind(FournisseurTruffesController)
);

// DELETE /api/v1/fournisseurs-truffes/:id - Supprime (soft delete) un fournisseur
router.delete('/fournisseurs-truffes/:id',
  FournisseurTruffesController.deleteFournisseur.bind(FournisseurTruffesController)
);

// GET /api/v1/fournisseurs-truffes/:id/contacts - Liste les contacts
router.get('/fournisseurs-truffes/:id/contacts',
  FournisseurTruffesController.getContacts.bind(FournisseurTruffesController)
);

// POST /api/v1/fournisseurs-truffes/:id/contacts - Ajoute un contact
router.post('/fournisseurs-truffes/:id/contacts',
  FournisseurTruffesController.addContact.bind(FournisseurTruffesController)
);

// ============================================================================
// ROUTES COMMANDES D'ACHAT
// ============================================================================

// GET /api/v1/commandes-achat - Liste toutes les commandes
router.get('/commandes-achat',
  CommandeAchatController.getAllCommandes.bind(CommandeAchatController)
);

// POST /api/v1/commandes-achat - Crée une nouvelle commande
router.post('/commandes-achat',
  CommandeAchatController.createCommande.bind(CommandeAchatController)
);

// GET /api/v1/commandes-achat/:id - Détails d'une commande
router.get('/commandes-achat/:id',
  CommandeAchatController.getCommande.bind(CommandeAchatController)
);

// PUT /api/v1/commandes-achat/:id/confirmer - Confirme une commande
router.put('/commandes-achat/:id/confirmer',
  CommandeAchatController.confirmerCommande.bind(CommandeAchatController)
);

// POST /api/v1/commandes-achat/:id/receptionner - Réceptionne une commande
router.post('/commandes-achat/:id/receptionner',
  CommandeAchatController.receptionnerCommande.bind(CommandeAchatController)
);

// ============================================================================
// ROUTES STOCK
// ============================================================================

// GET /api/v1/stock-truffes-achetees - Liste le stock
router.get('/stock-truffes-achetees',
  stockController.getStock.bind(stockController)
);

// GET /api/v1/stock-disponible - Vue stock disponible
router.get('/stock-disponible',
  stockController.getStockDisponible.bind(stockController)
);

// GET /api/v1/stock-alerte-limite - Stock avec dates limites approchant
router.get('/stock-alerte-limite',
  stockController.getStockAlerte.bind(stockController)
);

// PUT /api/v1/stock-truffes-achetees/:id - Met à jour le stock
router.put('/stock-truffes-achetees/:id',
  stockController.updateStock.bind(stockController)
);

// ============================================================================
// ROUTES ANALYTIQUE
// ============================================================================

// GET /api/v1/analytics/marge-globale - Marge globale
router.get('/analytics/marge-globale',
  analytiqueController.getMargeGlobale.bind(analytiqueController)
);

// GET /api/v1/analytics/marge-par-calibre - Marge par calibre
router.get('/analytics/marge-par-calibre',
  analytiqueController.getMargeParCalibre.bind(analytiqueController)
);

// GET /api/v1/analytics/fournisseurs-performance - Performance des fournisseurs
router.get('/analytics/fournisseurs-performance',
  FournisseurTruffesController.getPerformance.bind(FournisseurTruffesController)
);

// GET /api/v1/analytics/fournisseurs-rentabilite - Rentabilité par fournisseur
router.get('/analytics/fournisseurs-rentabilite',
  analytiqueController.getFournisseurRentabilite.bind(analytiqueController)
);

// GET /api/v1/analytics/commandes-en-retard - Commandes en retard
router.get('/analytics/commandes-en-retard',
  analytiqueController.getCommandesEnRetard.bind(analytiqueController)
);

// GET /api/v1/analytics/stats-dashboard - Stats pour le dashboard
router.get('/analytics/stats-dashboard',
  analytiqueController.getStatsDashboard.bind(analytiqueController)
);

export default router;
