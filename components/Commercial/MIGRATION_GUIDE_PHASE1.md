# 🛠️ Phase 1 : Guide de Migration - Constantes

## ✅ Étape 1 : Fichier créé
- `frontend/src/components/Commercial/utils/constants.js` ✅

## 📝 Étape 2 : Modifier Commercial.js

### 1. Ajouter l'import en haut du fichier

**LIGNE ~19** - Après les autres imports, ajouter :

```javascript
import {
  STATUT_COLORS_COMMANDES,
  STATUT_COLORS_VENTES,
  COLORS_PIE_CHART,
  TVA_RATE,
  CLIENT_TYPES,
  STATUTS_COMMANDE,
  STATUTS_VENTE,
  TYPES_CLIENT,
  PAGINATION_DEFAULTS,
  MESSAGES,
  TAB_LABELS,
  DEFAULT_FORM_VALUES,
  DEFAULT_SORT_CONFIG
} from './utils/constants';
```

### 2. Supprimer les anciennes définitions de constantes

**LIGNES à SUPPRIMER (lignes 24-51)** :

```javascript
// ❌ SUPPRIMER TOUT CE BLOC
const STATUT_COLORS_COMMANDES = {
  'En attente': { background: '#fff3cd', color: '#856404', border: '#ffc107' },
  // ...
};

const STATUT_COLORS_VENTES = {
  // ...
};

const COLORS_PIE_CHART = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const TVA_RATE = 0.055;

const CLIENT_TYPES = {
  'Particulier': '👤',
  'Restaurant': '🍽️',
  'Grossiste': '📦',
  'Association': '🤝'
};
```

### 3. Remplacer les valeurs par défaut dans les useState

**LIGNE ~140** - Remplacer l'initialisation de `itemsPerPageClients` :
```javascript
// Avant
const [itemsPerPageClients, setItemsPerPageClients] = useState(50);

// Après
const [itemsPerPageClients, setItemsPerPageClients] = useState(PAGINATION_DEFAULTS.CLIENTS_PER_PAGE);
```

**LIGNE ~141** - Remplacer l'initialisation de `itemsPerPageVentes` :
```javascript
// Avant
const [itemsPerPageVentes, setItemsPerPageVentes] = useState(20);

// Après
const [itemsPerPageVentes, setItemsPerPageVentes] = useState(PAGINATION_DEFAULTS.VENTES_PER_PAGE);
```

**LIGNE ~144-145** - Remplacer les configs de tri :
```javascript
// Avant
const [sortConfigClients, setSortConfigClients] = useState({ key: null, direction: 'asc' });
const [sortConfigCommandes, setSortConfigCommandes] = useState({ key: 'date_commande', direction: 'desc' });
const [sortConfigVentes, setSortConfigVentes] = useState({ key: 'date_vente', direction: 'desc' });

// Après
const [sortConfigClients, setSortConfigClients] = useState(DEFAULT_SORT_CONFIG.CLIENTS);
const [sortConfigCommandes, setSortConfigCommandes] = useState(DEFAULT_SORT_CONFIG.COMMANDES);
const [sortConfigVentes, setSortConfigVentes] = useState(DEFAULT_SORT_CONFIG.VENTES);
```

**LIGNE ~158** - Remplacer l'initialisation de `clientFormData` :
```javascript
// Avant
const [clientFormData, setClientFormData] = useState({
  type: 'Particulier',
  nom: '',
  // ... tous les champs
});

// Après
const [clientFormData, setClientFormData] = useState(DEFAULT_FORM_VALUES.CLIENT);
```

**LIGNE ~171** - Remplacer l'initialisation de `commandeFormData` :
```javascript
// Avant
const [commandeFormData, setCommandeFormData] = useState({
  client_id: '',
  date_commande: new Date().toISOString().split('T')[0],
  // ...
});

// Après
const [commandeFormData, setCommandeFormData] = useState({
  ...DEFAULT_FORM_VALUES.COMMANDE,
  date_commande: DEFAULT_FORM_VALUES.COMMANDE.date_commande()
});
```

**LIGNE ~183** - Remplacer l'initialisation de `venteFormData` :
```javascript
// Avant
const [venteFormData, setVenteFormData] = useState({
  client_id: '',
  recolte_id: '',
  date_vente: new Date().toISOString().split('T')[0],
  // ...
});

// Après
const [venteFormData, setVenteFormData] = useState({
  ...DEFAULT_FORM_VALUES.VENTE,
  date_vente: DEFAULT_FORM_VALUES.VENTE.date_vente()
});
```

**LIGNE ~195** - Remplacer l'initialisation de `newClientData` :
```javascript
// Avant
const [newClientData, setNewClientData] = useState({
  type: 'Particulier',
  // ...
});

// Après
const [newClientData, setNewClientData] = useState(DEFAULT_FORM_VALUES.CLIENT);
```

### 4. Remplacer les messages dans les fonctions

**Dans `handleClientSubmit` (ligne ~456-458)** :
```javascript
// Avant
showMessage('Client mis à jour avec succès !', 'success');
// ou
showMessage('Client créé avec succès !', 'success');

// Après
showMessage(MESSAGES.CLIENT.UPDATE_SUCCESS, 'success');
// ou
showMessage(MESSAGES.CLIENT.CREATE_SUCCESS, 'success');
```

**Dans `askDeleteClient` (ligne ~487)** :
```javascript
// Avant
message: `Êtes-vous sûr de vouloir supprimer le client ${clientName} ? Cette action est irréversible.`,

// Après
message: `${MESSAGES.CLIENT.DELETE_CONFIRM}\n${clientName}`,
```

**Répéter le processus pour** :
- `handleCommandeSubmit` (lignes ~626-633)
- `handleVenteSubmit` (lignes ~706-713)
- `doDeleteClient`, `doDeleteCommande`, `doDeleteVente`
- Tous les messages d'erreur

### 5. Remplacer les labels des onglets (ligne ~996)

```javascript
// Avant
<button ...>
  👥 Clients ({statsClients.total})
</button>

// Après
<button ...>
  {TAB_LABELS.CLIENTS} ({statsClients.total})
</button>
```

Répéter pour tous les onglets.

## 🎯 Résultat attendu

✅ Moins de lignes dans Commercial.js (environ -50 lignes)
✅ Constantes centralisées et réutilisables
✅ Plus facile à maintenir (changement de couleur = 1 seul endroit)
✅ Meilleure lisibilité du code

## 🚨 Points d'attention

1. **Ne pas oublier l'import** en haut de Commercial.js
2. **Attention aux fonctions** dans DEFAULT_FORM_VALUES (date_commande, date_vente)
3. **Tester après chaque modification** pour vérifier que tout fonctionne

## 🔧 Commande pour tester

```bash
cd frontend
npm start
```

Vérifier :
- L'ouverture de l'onglet Commercial
- La création d'un client
- Les couleurs des badges de statut
- Les messages de notification

## 🚀 Prochaine étape

**Phase 2 : Composants UI simples** (StatsCard, StatusBadge, PaginationControls)
