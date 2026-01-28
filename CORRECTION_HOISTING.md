# Correction Erreur: Cannot access 'sortedClients' before initialization

## ⚠️ Problème
```
ReferenceError: Cannot access 'sortedClients' before initialization
```

## 🔍 Cause
Les variables `sortedClients`, `filteredClients`, etc. sont utilisées dans le JSX **AVANT** d'être définies.

## ✅ Solution

### Étape 1: Localiser le bloc de définitions des variables

Chercher vers la **ligne 1050** ce bloc :

```javascript
// ==================== FILTRAGE ====================

const filteredClients = clients.filter(client => {
  const matchType = filterTypeClient === 'all' || client.type === filterTypeClient;
  const searchLower = searchTermClient.toLowerCase();
  const matchSearch = !searchTermClient ||
    client.nom?.toLowerCase().includes(searchLower) ||
    client.prenom?.toLowerCase().includes(searchLower) ||
    client.raison_sociale?.toLowerCase().includes(searchLower) ||
    client.email?.toLowerCase().includes(searchLower) ||
    client.ville?.toLowerCase().includes(searchLower);
  return matchType && matchSearch;
});

const filteredCommandes = commandes.filter(c =>
  filterStatutCommande === 'all' || c.statut === filterStatutCommande
);

const filteredVentes = ventes.filter(v => {
  const matchStatut = filterStatutVente === 'all' || v.statut === filterStatutVente;
  const client = clients.find(c => c.id === v.client_id);
  const matchType = filterTypeVente === 'all' || (client && client.type === filterTypeVente);
  return matchStatut && matchType;
});

const sortedClients = sortData(filteredClients, sortConfigClients);
const sortedCommandes = sortData(filteredCommandes, sortConfigCommandes);
const sortedVentes = sortData(filteredVentes, sortConfigVentes);

const paginatedClients = paginateClients(sortedClients, currentPageClients, itemsPerPageClients);
const paginatedCommandes = paginateClients(sortedCommandes, currentPageCommandes, 50);
const paginatedVentes = paginateVentes(sortedVentes, currentPageVentes, itemsPerPageVentes);
```

### Étape 2: Couper ce bloc entier

**COUPER** tout ce bloc (depuis `// ==================== FILTRAGE ====` jusqu'à `paginatedVentes = ...`)

### Étape 3: Le coller AVANT les STATISTIQUES

Chercher vers la **ligne 1020** ce bloc :

```javascript
// ==================== STATISTIQUES ====================

const statsClients = {
  total: clients.length,
  particuliers: clients.filter(c => c.type === 'Particulier').length,
  restaurants: clients.filter(c => c.type === 'Restaurant').length,
  grossistes: clients.filter(c => c.type === 'Grossiste').length,
  associations: clients.filter(c => c.type === 'Association').length
};
```

**COLLER** le bloc de filtrage juste **AVANT** ce bloc de statistiques.

### Étape 4: Ordre final attendu

Après correction, l'ordre doit être :

```javascript
// ... (toutes les fonctions: handleSort, sortData, paginateClients, etc.)

// ==================== FILTRAGE ====================
const filteredClients = ...
const filteredCommandes = ...
const filteredVentes = ...
const sortedClients = ...
const sortedCommandes = ...
const sortedVentes = ...
const paginatedClients = ...
const paginatedCommandes = ...
const paginatedVentes = ...

// ==================== STATISTIQUES ====================
const statsClients = { ... }
const statsCommandes = { ... }
const statsVentes = { ... }

// ==================== LOADING ====================
if (loading || loadingClientsSettings || loadingVentesSettings) {
  return ...
}

// ==================== RENDER ====================
return (
  <div className="commercial-container">
    ...
  </div>
);
```

## 📝 Résumé

**Déplacer le bloc de filtrage/tri/pagination (lignes ~1050-1070) AVANT le bloc des statistiques (ligne ~1020)**

Cela garantit que toutes les variables sont initialisées **avant** d'être utilisées dans le JSX.

---

**Date**: 29 janvier 2026  
**Fichier**: `frontend/src/components/Commercial.js`  
**Erreur**: `Cannot access 'sortedClients' before initialization`
