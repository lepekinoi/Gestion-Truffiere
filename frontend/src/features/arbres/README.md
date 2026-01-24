# Feature Arbres

Cette feature gère la gestion complète des arbres de la truffière.

## Structure des dossiers

```
arbres/
├── pages/                    # Pages principales
│   ├── ArbresPage.jsx        # Page d'accueil feature
│   └── index.js              # Exports
├── components/             # Composants réutilisables
│   ├── ArbresList.jsx       # (future) Liste des arbres
│   ├── ArbresForm.jsx       # (future) Formulaire CRUD
│   ├── ArbresDetail.jsx     # (future) Fiche détaillée
│   └── index.js              # Exports
├── hooks/                  # Hooks personnalisés
│   ├── useArbres.js         # Gestion de la liste des arbres
│   ├── useArbreForm.js      # (future) Gestion du formulaire
│   └── index.js              # Exports
├── services/               # Appels API
│   ├── arbresService.js     # CRUD arbres
│   └── index.js              # Exports
├── utils/                  # Fonctions utilitaires
│   ├── arbresValidation.js  # Validation des données
│   ├── arbresFormatters.js  # Formatage pour l'affichage
│   └── index.js              # Exports
├── constants/              # Constantes métier
│   ├── arbresConstants.js   # Enums et constantes
│   └── index.js              # Exports
├── index.js                # Export principal de la feature
└── README.md               # Cette documentation
```

## Utilisation

### Importer la page

```javascript
import { ArbresPage } from '@/features/arbres';

// Ou plus spécifiquement
import { ArbresPage } from '@/features/arbres/pages';
```

### Utiliser les hooks

```javascript
import { useArbres } from '@/features/arbres';

const MyComponent = () => {
  const { arbres, loading, error, refetch } = useArbres();
  
  return (
    <div>
      {loading && <p>Chargement...</p>}
      {error && <p>Erreur: {error}</p>}
      {arbres.map(arbre => <div key={arbre.id}>{arbre.nom}</div>)}
    </div>
  );
};
```

### Appeler les services API

```javascript
import { getArbres, createArbre, updateArbre, deleteArbre } from '@/features/arbres';

// Récupérer tous les arbres
const arbres = await getArbres();

// Créer un nouvel arbre
const newArbre = await createArbre({ 
  nom: 'Arbre 1', 
  type: 'TRUFFIER' 
});

// Modifier un arbre
await updateArbre(1, { nom: 'Arbre 1 modifié' });

// Supprimer un arbre
await deleteArbre(1);
```

### Utiliser les validations

```javascript
import { validateArbre, validateGPS } from '@/features/arbres';

const arbreData = { nom: 'Arbre', type: 'TRUFFIER' };
const { isValid, errors } = validateArbre(arbreData);

if (!isValid) {
  console.error(errors);
}
```

### Utiliser les formatters

```javascript
import { 
  formatArbreName, 
  formatArbreType, 
  formatArbreStatus,
  formatArbreAge 
} from '@/features/arbres';

const arbre = { nom: 'Arbre 1', type: 'TRUFFIER', age: 5 };

console.log(formatArbreType(arbre.type));  // "Truffier"
console.log(formatArbreAge(arbre.age));    // "5 ans"
```

### Accéder aux constantes

```javascript
import { 
  ARBRE_STATUS, 
  ARBRE_TYPES, 
  ARBRE_AGE_RANGES,
  ARBRE_ERRORS,
  ARBRE_SUCCESS 
} from '@/features/arbres';

const newArbre = {
  type: ARBRE_TYPES.TRUFFLE,
  status: ARBRE_STATUS.ACTIVE
};
```

## Architecture

Cette feature suit l'architecture modulaire standard du projet :

1. **Pages** - Conteneurs page connectés au routing
2. **Components** - Composants réutilisables spécifiques au domaine
3. **Hooks** - Logique métier encapsulée
4. **Services** - Appels API abstraits
5. **Utils** - Fonctions utilitaires pures (validation, formatage)
6. **Constants** - Valeurs fixes et énumérations

## Prochaines étapes

- [ ] Créer le composant `ArbresList`
- [ ] Créer le composant `ArbresForm`
- [ ] Créer le composant `ArbresDetail`
- [ ] Créer le hook `useArbreForm` pour la gestion du formulaire
- [ ] Créer le hook `useArbreFilters` pour les filtres
- [ ] Ajouter les tests unitaires
- [ ] Ajouter les tests d'intégration

## Voir aussi

- [ARCHITECTURE.md](../../../ARCHITECTURE.md) - Architecture globale du projet
- [API.md](../../../API.md) - Documentation API
