# 📁 Base de Données - Gestion Truffière V7

Ce dossier contient les fichiers pour initialiser et gérer la base de données PostgreSQL.

## 📋 Fichiers

### `init_database.sql`
**Fichier d'initialisation propre** - Structure complète + Données système + Compte admin

**✅ Contenu :**
- Structure complète de la base (44 tables, séquences, index, contraintes, vues, triggers)
- **Tables de référence système avec données :**
  - `typesintervention` - Types d'interventions (Irrigation, Taille, Traitement phytosanitaire, Amendement, etc.)
  - `amendementsref` - Amendements de référence (Calcaire broyé, Dolomie, Chaux vive, etc.)
  - `produitsphyto` - Produits phytosanitaires de référence
- **Compte administrateur par défaut**
  - Email : `admin@truffiere.local`
  - Mot de passe : `admin123`
  - ⚠️ **IMPORTANT : Changez ce mot de passe après la première connexion !**

**❌ Non inclus** (pour garder le fichier léger ~100 KB) :
- Parcelles de l'exploitation
- Arbres mycorhizés (400+)
- Récoltes historiques (1600+)
- Interventions
- Clients et ventes

### `truffiere_YYYYMMDD_HHMMSS.sql`
**Sauvegarde complète** - Tout le contenu de la base (structure + toutes les données)

---

## 🚀 Démarrage rapide

### Option 1 : Nouvelle installation (base vierge)
Pour démarrer une nouvelle exploitation sans données historiques :

```bash
# 1. Créer la base
createdb gestion_truffiere

# 2. Initialiser avec la structure
psql -d gestion_truffiere -f database/init_database.sql

# 3. Se connecter à l'application
# Email: admin@truffiere.local
# Mot de passe: admin123
```

### Option 2 : Restauration avec données complètes
Pour restaurer une sauvegarde existante avec toutes les données :

```bash
# 1. Supprimer l'ancienne base (si elle existe)
dropdb gestion_truffiere

# 2. Recréer la base
createdb gestion_truffiere

# 3. Restaurer le dump complet
psql -d gestion_truffiere -f truffiere_20260129_220424.sql
```

---

## 💾 Sauvegardes régulières

### Créer une sauvegarde complète
```bash
pg_dump gestion_truffiere > truffiere_$(date +%Y%m%d_%H%M%S).sql
```

### Créer une sauvegarde compressée
```bash
pg_dump gestion_truffiere | gzip > truffiere_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restaurer une sauvegarde compressée
```bash
gunzip -c truffiere_20260129_220424.sql.gz | psql -d gestion_truffiere
```

---

## 🔐 Sécurité

### ⚠️ Changement du mot de passe admin

**Après la première connexion, changez IMMÉDIATEMENT le mot de passe :**

1. Connectez-vous avec `admin@truffiere.local` / `admin123`
2. Allez dans **Paramètres** → **Mon Profil**
3. Cliquez sur **Changer le mot de passe**
4. Entrez un nouveau mot de passe fort

### 🔒 Recommandations de sécurité

- ✅ Mot de passe : 12+ caractères, majuscules, minuscules, chiffres, symboles
- ✅ Utilisez un gestionnaire de mots de passe
- ✅ Créez des comptes distincts pour chaque utilisateur
- ✅ N'utilisez PAS le compte admin pour l'utilisation quotidienne
- ✅ Sauvegardez régulièrement la base de données
- ✅ Stockez les sauvegardes dans un endroit sécurisé (hors GitHub)

---

## 🗄️ Structure de la base

### Tables principales

| Table | Description |
|-------|-------------|
| `users` | Utilisateurs de l'application |
| `parcelles` | Parcelles de l'exploitation |
| `arbres` | Arbres mycorhizés |
| `recoltes` | Récoltes de truffes |
| `interventions` | Interventions sur les parcelles/arbres |
| `typesintervention` | Types d'interventions (référence) |
| `clients` | Clients pour les ventes |
| `ventes` | Ventes de truffes |
| `commandesachattruffes` | Commandes d'achat de truffes |
| `stockstruffesachetees` | Stock de truffes achetées |
| `amendementsref` | Amendements de référence |
| `produitsphyto` | Produits phytosanitaires |

### Tables détails interventions

- `irrigationdetails` - Irrigation
- `tailledetails` - Taille
- `traitementphytodetails` - Traitements phytosanitaires
- `amendementdetails` - Amendements
- `travailsoldetails` - Travail du sol
- `observationdetails` - Observations
- `paillagedetails` - Paillage
- `plantationdetails` - Plantations
- `analysesoldetails` - Analyses de sol
- `piegeagedetails` - Piégeage
- `inoculationdetails` - Inoculations

---

## 🆘 Dépannage

### Erreur : "La base de données existe déjà"
```bash
dropdb gestion_truffiere
createdb gestion_truffiere
psql -d gestion_truffiere -f database/init_database.sql
```

### Erreur : "Permission denied"
```bash
# Se connecter en tant que superutilisateur postgres
sudo -u postgres psql

# Dans psql :
GRANT ALL PRIVILEGES ON DATABASE gestion_truffiere TO votre_utilisateur;
```

### Vérifier que la base est bien initialisée
```bash
psql -d gestion_truffiere -c "\\dt"                # Liste des tables
psql -d gestion_truffiere -c "SELECT * FROM users;" # Vérifier le compte admin
```

---

## 📊 Informations système

- **SGBD :** PostgreSQL 16.4
- **Extension :** PostGIS (pour géométries de parcelles)
- **Encodage :** UTF-8
- **Version base :** V7
- **Date de génération :** 29 janvier 2026

---

## 📞 Support

En cas de problème :
- 📖 [Documentation complète](../README.md)
- 🐛 [Issues GitHub](https://github.com/lepekinoi/Gestion-Truffiere/issues)
- 💬 Contactez l'administrateur système
