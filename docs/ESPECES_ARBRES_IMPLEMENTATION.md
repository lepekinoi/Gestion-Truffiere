# 🌳 Gestion des Espèces d'Arbres - Documentation Complète

**Date**: 25 janvier 2026
**Version**: V6
**Auteur**: Implementation guidée

---

## 🎯 Sommaire des 3 éléments implémentés

### 1. **Base de données** 🖥️
### 2. **API Backend** 🕀
### 3. **Frontend React** 🟧

---

## 1. 🖥️ BASE DE DONNÉES - Table `especes_arbres`

### Fichier
```
migrations/add_especes_table.sql
```

### Structure de la table
```sql
CREATE TABLE especes_arbres (
    id INTEGER PRIMARY KEY,
    nom VARCHAR(100) NOT NULL UNIQUE,              -- "Chêne pubescent"
    code VARCHAR(10) NOT NULL UNIQUE,              -- "P"
    nom_scientifique VARCHAR(150),                 -- "Quercus pubescens"
    description TEXT,                              -- Description détaillée
    groupe_principal VARCHAR(50),                  -- "Chêne", "Charme", etc.
    est_espece_principale BOOLEAN DEFAULT false,   -- Espèces principales (4 initiales)
    ordre_affichage INTEGER DEFAULT 0,             -- Tri dans les selects
    actif BOOLEAN DEFAULT true,                    -- Statut
    notes TEXT,                                    -- Notes spécifiques
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Données initiales
**12 espèces insérées :**

#### Espèces Principales (4)
1. **Chêne pubescent** (P) - *Quercus pubescens*
2. **Chêne vert** (V) - *Quercus ilex*
3. **Charmes** (C) - *Carpinus betulus*
4. **Chênes Cerris** (Cé) - *Quercus cerris*

#### Nouvelles espèces (8)
5. Chêne blanc (Blanc)
6. Noisetier commun (N)
7. Tilleul à petites feuilles (Ti)
8. Châtaignier (Ch)
9. Chêne de Hongrie (Ho)
10. Érable champêtre (Éra)
11. Charme-houblon (CH)
12. Noisetier de Byzance (NB)

### Indexes
- `idx_especes_arbres_code` - Recherche rapide par code
- `idx_especes_arbres_nom` - Recherche par nom
- `idx_especes_arbres_actif` - Filtrer espèces actives
- `idx_especes_arbres_principal` - Filtrer principales

### Historique
- Trigger `especes_arbres_historique` enregistre tous les changements

---

## 2. 🕀 API BACKEND

### Fichier
```
backend/routes/especes.routes.js
```

### Endpoints

#### **GET /api/especes**
Récupérer la liste des espèces avec filtres avancés

**Query Parameters:**
- `actif` (boolean) : filtrer espèces actives/inactives
- `principal` (boolean) : uniquement les espèces principales
- `groupe` (string) : filtrer par groupe ("Chêne", "Charme", etc.)
- `search` (string) : recherche textuelle

**Exemple:**
```bash
GET /api/especes?actif=true&principal=false&groupe=Ch%C3%AAne
```

**Réponse:**
```json
[
  {
    "id": 1,
    "nom": "Chêne pubescent",
    "code": "P",
    "nom_scientifique": "Quercus pubescens",
    "description": "Chêne résistant à la sécheresse...",
    "groupe_principal": "Chêne",
    "est_espece_principale": true,
    "ordre_affichage": 1,
    "actif": true,
    "created_at": "2026-01-25T00:00:00Z",
    "updated_at": "2026-01-25T00:00:00Z"
  }
]
```

---

#### **GET /api/especes/:id**
Récupérer une espèce spécifique

**Paramètre:**
- `id` (integer) : ID de l'espèce

**Exemple:**
```bash
GET /api/especes/1
```

---

#### **GET /api/especes/groupes/list**
Récupérer les groupes uniques d'espèces

**Réponse:**
```json
[
  "Chêne",
  "Charme",
  "Noisetier",
  "Tilleul",
  "Châtaignier",
  "Érable"
]
```

---

#### **GET /api/especes/stats/overview**
Statistiques sur les espèces

**Réponse:**
```json
{
  "total_especes": 12,
  "especes_principales": 4,
  "especes_actives": 12,
  "par_groupe": [
    {
      "groupe_principal": "Chêne",
      "especes_count": 5,
      "arbres_count": 42
    },
    {
      "groupe_principal": "Charme",
      "especes_count": 2,
      "arbres_count": 15
    }
  ]
}
```

### Integration dans server.js

Ajouter dans `backend/server.js` (après les autres routes):

```javascript
// === ROUTES ESPECES ===
const especesRoutes = require('./routes/especes.routes');
app.use('/api/especes', (req, res, next) => {
  req.pool = pool; // Passer la pool de connexion
  especesRoutes(req, res, next);
});
```

---

## 3. 🟧 FRONTEND REACT

### Composant EspeceSelector

**Fichiers:**
```
frontend/src/features/arbres/components/EspeceSelector.jsx
frontend/src/features/arbres/components/EspeceSelector.css
```

### Fonctionnalités

- **Autocomplete** : Filtrage dynamique en temps réel
- **Dropdown** : Liste déroulante avec scroll
- **Infos dynamiques** : Affichage du groupe, nom scientifique, description
- **Badge principal** : ★ pour les espèces principales
- **Recherche avancée** : Par nom, code, scientifique, groupe
- **Clavier** : Support des flèches et Échap
- **Accessibilité** : Styled correctement pour le responsive

### Props

```jsx
<EspeceSelector
  value="Chêne pubescent"           // Valeur initiale
  onChange={(value) => {}}            // Callback onChange
  placeholder="Sélectionner..."
  disabled={false}                    // Actif/Inactif
  required={true}                     // Requis ou non
  showInfos={true}                    // Afficher infos
  allowFreeText={true}                // Autoriser texte libre
/>
```

### Utilisation dans ArbresPage

Remplacer le champ `espece` dans le formulaire:

```jsx
// AVANT (input texte)
<div className="form-group">
  <label>Espèce</label>
  <input 
    type="text" 
    name="espece" 
    value={formData.espece} 
    onChange={handleInputChange} 
    placeholder="Ex: Noisetier" 
  />
</div>

// APRÈS (avec autocomplete)
<div className="form-group">
  <label>Espèce</label>
  <EspeceSelector
    value={formData.espece}
    onChange={(value) => handleInputChange({ target: { name: 'espece', value } })}
    placeholder="Sélectionner une espèce..."
    required={false}
    showInfos={true}
  />
</div>
```

### Import

```jsx
import EspeceSelector from '../components/EspeceSelector';
```

---

## 🔧 INSTALLATION

### Première utilisation

**1. Exécuter la migration SQL**
```bash
psql -U db_user -d db_name -f migrations/add_especes_table.sql
```

**2. Verifier que les tables existent**
```sql
SELECT * FROM especes_arbres LIMIT 5;
-- Doit retourner 12 espèces
```

**3. Relancer le backend**
```bash
cd backend
npm start
```

**4. Vérifier l'endpoint**
```bash
curl http://localhost:3001/api/especes
```

**5. Intégrer le composant dans ArbresPage.jsx**

---

## 🌟 Cas d'usage

### Exemple 1: Formulaire de création d'arbre
```jsx
<EspeceSelector
  value={formData.espece}
  onChange={(value) => setFormData({...formData, espece: value})}
  placeholder="Choisir une espèce d'arbre..."
  required={true}
  showInfos={true}
/>
```

### Exemple 2: Filtre dans le tableau
```jsx
<EspeceSelector
  value={filters.espece}
  onChange={(value) => handleFilterChange('espece', value)}
  placeholder="Filtrer par espèce..."
  showInfos={false}
/>
```

### Exemple 3: Lecture seule
```jsx
<EspeceSelector
  value={arbre.espece}
  disabled={true}
  showInfos={true}
/>
```

---

## 🔍 Debugging

### Vérifier les espèces chargées
```javascript
// Dans la console du navigateur
fetch('http://localhost:3001/api/especes')
  .then(r => r.json())
  .then(data => console.table(data))
```

### Vérifier la base de données
```sql
SELECT nom, code, groupe_principal, est_espece_principale FROM especes_arbres ORDER BY ordre_affichage;
```

### Vérifier le composant React
```jsx
import EspeceSelector from '../components/EspeceSelector';

// Dans un test simple
const [espece, setEspece] = React.useState('');

return (
  <EspeceSelector 
    value={espece} 
    onChange={(val) => {
      console.log('Espèce sélectionnée:', val);
      setEspece(val);
    }}
  />
);
```

---

## 📊 Améliorations futures

- [ ] Ajouter des routes POST/PUT/DELETE pour gérer les espèces (admin)
- [ ] Ajouter des images/photos pour chaque espèce
- [ ] Ajouter des caractéristiques (hauteur moyenne, âge productif, etc.)
- [ ] Ajouter les compétabilités de plantation (compagnonnage)
- [ ] Ajouter les rendements estimés par espèce
- [ ] Export/Import des espèces en CSV
- [ ] Gestion des variétés pour chaque espèce
- [ ] Synonimies (noms alternatifs)

---

## 🤝 Support

Pour toute question ou problème:
1. Vérifier les logs du backend
2. Vérifier la console du navigateur
3. Vérifier la table `especes_arbres` existe
4. Vérifier les données initiales sont présentes

---

**Fin de documentation**
