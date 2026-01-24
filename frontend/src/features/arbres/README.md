# Feature: Gestion des Arbres 🌳

Gestion complète des arbres de la truffière avec interface CRUD intuitive.

## Structure du Dossier

```
arbres/
├── pages/
│   ├── ArbresPage.jsx          # Page principale - Interface CRUD
│   └── ArbresPage.css          # Styles de la page
├── components/                  # Composants réutilisables (futurs)
├── hooks/
│   └── useArbres.js            # Hook personnalisé (optionnel pour futurs usages)
├── services/
│   └── arbresService.js        # Appels API CRUD
├── constants/
│   └── arbresConstants.js       # Constantes métier et enums
├── utils/
│   ├── arbresValidation.js     # Validation des données
│   └── arbresFormatters.js     # Formatage pour l'affichage
├── index.js                     # Export central de la feature
└── README.md                    # Cette documentation
```

## Fichiers Principaux

### `pages/ArbresPage.jsx`
**Page principale avec interface complète CRUD**

- ✅ Récupération et affichage de tous les arbres
- ✅ Recherche et filtrage par parcelle/espèce/numéro
- ✅ Création de nouveaux arbres (modal)
- ✅ Modification d'arbres existants
- ✅ Suppression avec confirmation
- ✅ Affichage détaillé de l'arbre sélectionné
- ✅ Gestion de l'authentification (`canWrite()`)
- ✅ Messages de succès/erreur

**Props:**
- `highlightId` (optional) - ID de l'arbre à surligner au chargement

### `services/arbresService.js`
**Service d'appels API avec axios**

Fonctions exportées:
- `getArbres()` - Récupérer tous les arbres
- `getArbre(id)` - Récupérer un arbre spécifique
- `createArbre(data)` - Créer un arbre
- `updateArbre(id, data)` - Modifier un arbre
- `deleteArbre(id)` - Supprimer un arbre

**Authentification:**
Utilise axios qui hérite automatiquement des headers d'authentification via l'intercepteur du contexte `AuthContext`.

### `hooks/useArbres.js`
**Hook personnalisé pour la récupération de données**

```javascript
const { arbres, loading, error, refetch } = useArbres();
```

**Retour:**
- `arbres` - Tableau des arbres
- `loading` - État de chargement
- `error` - Message d'erreur éventuel
- `refetch` - Fonction pour rechargér les données

### `constants/arbresConstants.js`
**Constantes métier**

- `ARBRE_ERRORS` - Messages d'erreur standards
- `ARBRE_ETATS` - États sanitaires possibles
- `PARCELLE_TYPES` - Types de parcelles

### `utils/arbresValidation.js`
**Validation des données d'arbre**

```javascript
const errors = validateArbre(data);
```

Vérifie:
- Numéro obligatoire
- Format de la date
- Types de données

### `utils/arbresFormatters.js`
**Formatage pour l'affichage**

```javascript
formatDatePlantation(date)     // Format JJ/MM/AAAA
formatAgeArbre(age)            // Format "2 ans"
formatEtatSanitaire(etat)      // Label avec emoji
```

## Utilisation

### Import Simple
```javascript
import ArbresPage from '@/features/arbres/pages/ArbresPage';

// Dans le composant
<ArbresPage highlightId={treeId} />
```

### Avec Hook
```javascript
import { useArbres } from '@/features/arbres/hooks/useArbres';

const MyComponent = () => {
  const { arbres, loading, error, refetch } = useArbres();
  // ...
};
```

### Service Direct
```javascript
import { getArbres, createArbre } from '@/features/arbres/services/arbresService';

const arbres = await getArbres();
const newArbre = await createArbre({ numero: 'A-001', espece: 'Noisetier' });
```

## Interface Utilisateur

### Recherche et Filtres
- 🔍 Recherche textuelle (numéro, espèce, variété)
- 📦 Filtre par parcelle
- 🔄 Réinitialiser les filtres

### Gestion des Arbres
- 📋 Affichage en grille de cartes
- ✏️ Bouton modifier (modal)
- 🗑️ Bouton supprimer (avec confirmation)
- 📊 Détails complets de l'arbre sélectionné

### Formulaire Modal
**Champs:**
- Parcelle * (obligatoire)
- Numéro * (obligatoire)
- Espèce
- Variété de truffe
- Âge (ans)
- Porte-greffe
- Date de plantation
- État sanitaire (select: Excellent/Bon/Moyen/Mauvais)
- Rendement estimé (kg/an)
- Notes (textarea)

## Points Clés

### Authentification
- ✅ Utilise le contexte `useAuth()` pour vérifier les permissions
- ✅ Boutons CRUD désactivés si `canWrite()` est false
- ✅ Axios hérite automatiquement du token JWT

### Gestion d'Erreurs
- ✅ Erreurs 401 résolues (axios avec headers)
- ✅ Messages utilisateur clairs
- ✅ Notifications toast (success/error)

### Performance
- ✅ Appels API parallélissés (`Promise.all`)
- ✅ Pas de refetch inutile
- ✅ État local pour les filtres

## Pattern Conformé à RecoltesPage

Cette feature suit exactement le même pattern que `RecoltesPage`:

✅ Import axios + API_URL  
✅ Gestion d'authentification avec `useAuth()`  
✅ States pour modal, filtres, sélection  
✅ Validation et messages utilisateur  
✅ Service layer avec axios  
✅ Hooks optionnels pour futurs composants  
✅ CSS dédié  

## Futur (Optionnel)

### Ajouter des Composants
```
components/
├── ArbreCard.jsx        # Carte d'affichage réutilisée
├── ArbreForm.jsx        # Formulaire séparé
└── ArbreDetail.jsx      # Pénél de détail
```

### Ajouter des Utilitaires
```
utils/
├── arbresCalculations.js     # Rendement, productivité, etc.
├── arbresExport.js           # Export CSV/PDF
└── arbresImport.js           # Import CSV
```

## Crédits

Structure basée sur le pattern `RecoltesPage` pour cohérence de l'application.

---

**Dernière mise à jour:** Janvier 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
