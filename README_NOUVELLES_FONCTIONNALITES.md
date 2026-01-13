# Nouvelles Fonctionnalités - Truffière Management

Ce document décrit les trois nouvelles fonctionnalités ajoutées à l'application de gestion de truffière.

## 📦 1. Calcul de Stock Automatique

### Description
Le système calcule automatiquement le stock disponible en temps réel :
- **Stock = Total Récolté - Total Vendu (payé)**
- Détail par qualité et calibre
- Détail par saison de récolte
- Estimation de la valeur du stock

### Nouveaux fichiers
- `StockWidget.js` - Composant React pour afficher le stock

### API Backend (à ajouter dans server.js)
```
GET /api/stock - Récupère le calcul complet du stock
GET /api/stock/recolte/:id - Stock disponible pour une récolte spécifique
```

### Utilisation
```jsx
import StockWidget from './components/StockWidget';

// Version complète
<StockWidget />

// Version compacte pour le dashboard
<StockWidget compact={true} />
```

---

## 🧾 2. Génération de Factures PDF

### Description
Génération de factures professionnelles au format PDF pour les ventes :
- En-tête avec informations de l'entreprise
- Coordonnées client complètes
- Détail du produit (qualité, calibre, maturité)
- Calcul automatique TVA (5.5% pour produits alimentaires)
- Coordonnées bancaires et mentions légales

### Nouveaux fichiers
- `pdfExport.js` - Ajout de la fonction `exportFacturePDF()`

### API Backend (à ajouter dans server.js)
```
GET /api/factures/:venteId - Récupère les données pour générer une facture
POST /api/factures/generer-numero - Génère un nouveau numéro de facture
```

### Utilisation
```jsx
import { exportFacturePDF } from '../utils/pdfExport';
import axios from 'axios';

// Récupérer les données et générer la facture
const response = await axios.get(`/api/factures/${venteId}`);
exportFacturePDF(response.data);
```

### Paramètres entreprise à configurer
Dans la table `parametres`, ajoutez :
- `entreprise_nom` - Nom de l'entreprise
- `entreprise_adresse` - Adresse
- `entreprise_code_postal` - Code postal
- `entreprise_ville` - Ville
- `entreprise_telephone` - Téléphone
- `entreprise_email` - Email
- `entreprise_siret` - Numéro SIRET
- `entreprise_tva` - Numéro TVA intracommunautaire
- `facture_iban` - IBAN
- `facture_bic` - BIC
- `facture_mentions_legales` - Mentions légales
- `facture_conditions_paiement` - Conditions de paiement

---

## 🔍 3. Recherche Globale

### Description
Barre de recherche dans la navbar permettant de chercher dans toutes les entités :
- Parcelles
- Arbres
- Récoltes
- Clients
- Ventes
- Commandes
- Interventions

### Fonctionnalités
- Recherche instantanée avec debounce (300ms)
- Navigation clavier (↑↓ pour naviguer, Entrée pour sélectionner)
- Raccourci clavier Ctrl+K pour ouvrir
- Résultats groupés par catégorie
- Navigation directe vers l'élément trouvé

### Nouveaux fichiers
- `GlobalSearch.js` - Composant de recherche globale

### API Backend (à ajouter dans server.js)
```
GET /api/search/global?q=terme - Recherche globale
```

### Intégration dans App.js
```jsx
import GlobalSearch from './components/GlobalSearch';

// Dans la navbar
<GlobalSearch onNavigate={handleSearchNavigate} />
```

---

## 📁 Structure des fichiers modifiés/ajoutés

```
src/
├── components/
│   ├── GlobalSearch.js      (NOUVEAU)
│   └── StockWidget.js       (NOUVEAU)
├── utils/
│   └── pdfExport.js         (MODIFIÉ - ajout exportFacturePDF)
├── App.js                   (MODIFIÉ - intégration GlobalSearch)
├── App.css                  (MODIFIÉ - styles animations)
└── server.js                (MODIFIÉ - nouvelles routes API)
```

---

## 🚀 Instructions d'installation

### 1. Copier les nouveaux fichiers
```bash
# Composants React
cp GlobalSearch.js src/components/
cp StockWidget.js src/components/

# Mettre à jour les fichiers existants
cp App.js src/
cp App.css src/
cp pdfExport.js src/utils/
cp server.js ./
```

### 2. Ajouter les paramètres entreprise (SQL)
```sql
INSERT INTO parametres (cle, valeur, categorie) VALUES
('entreprise_nom', 'Ma Truffière', 'entreprise'),
('entreprise_adresse', '123 Chemin des Chênes', 'entreprise'),
('entreprise_code_postal', '84000', 'entreprise'),
('entreprise_ville', 'Avignon', 'entreprise'),
('entreprise_telephone', '04 90 XX XX XX', 'entreprise'),
('entreprise_email', 'contact@matruffiere.fr', 'entreprise'),
('entreprise_siret', '123 456 789 00012', 'entreprise'),
('facture_conditions_paiement', 'Paiement à réception', 'facturation'),
('facture_mentions_legales', 'TVA non applicable, art. 293 B du CGI', 'facturation');
```

### 3. Redémarrer les services
```bash
# Backend
npm restart

# Frontend (si nécessaire)
npm run build
```

---

## 📊 Exemple d'utilisation du Stock Widget dans le Dashboard

```jsx
// Dans Dashboard.js
import StockWidget from './StockWidget';

function Dashboard() {
  return (
    <div className="dashboard">
      {/* Autres widgets */}
      
      <div className="dashboard-row">
        <StockWidget compact={true} />
        {/* Autres widgets compacts */}
      </div>
      
      {/* Widget stock complet */}
      <StockWidget />
    </div>
  );
}
```

---

## 🔒 Sécurité

- Les routes de modification nécessitent `requireWriteAccess`
- La génération de numéro de facture nécessite une authentification
- Les recherches sont limitées à 5 résultats par catégorie

---

## 📝 Notes de version

**Version 2.1.0** - Janvier 2026
- Ajout du calcul de stock automatique
- Ajout de la génération de factures PDF
- Ajout de la recherche globale
- Raccourci clavier Ctrl+K pour la recherche
