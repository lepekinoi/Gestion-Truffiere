# 📁 Base de Données — Gestion-Truffière V8

Ce dossier contient les fichiers pour initialiser et gérer la base de données PostgreSQL.

---

## 📋 Fichiers

### `init_database.sql`

Dump complet de la base de production — structure + données système + compte administrateur.

**Contenu :**
- Structure complète (tables, séquences, index, contraintes, vues, triggers, fonctions PLpgSQL)
- Extensions PostGIS (géométries parcelles et arbres, SRID 4326)
- Tables de référence avec données système :
  - `types_intervention` — Irrigation, Taille, Traitement phytosanitaire, Amendement, etc.
  - `amendements_ref` — Calcaire broyé, Dolomie, Chaux vive, etc.
  - `produits_phyto` — Produits phytosanitaires de référence
  - `parametres` — Paramètres entreprise (nom, coordonnées)
- Compte administrateur par défaut :
  - Email : `admin@truffiere.local`
  - Mot de passe : `admin123`
  - ⚠️ **Changez ce mot de passe immédiatement après la première connexion.**

**Non inclus** (données d'exploitation réelles) :
- Parcelles, arbres, récoltes, interventions, clients, ventes

---

## ⚠️ Prérequis important — rôle PostgreSQL

Le dump a été généré avec le rôle `unstuffed1004` comme owner de toutes les tables et fonctions.

Sur un environnement neuf (Docker ou serveur dédié), si ce rôle n'existe pas, l'import échouera avec :
```
ERROR: role "unstuffed1004" does not exist
```

**Contournement :** créer le rôle avant l'import :
```sql
-- En tant que superutilisateur postgres
CREATE ROLE unstuffed1004 LOGIN PASSWORD 'mot_de_passe_fort';
```

Ou utiliser la substitution à l'import :
```bash
sed 's/unstuffed1004/postgres/g' database/init_database.sql | psql -U postgres -d truffiere_db
```

> En environnement Docker (docker-compose), le `POSTGRES_USER` défini dans le `.env` doit correspondre au rôle utilisé. Adapter `docker-compose.yml` en conséquence.

---

## 🚀 Installation

### Nouvelle installation (base vierge)

```bash
# 1. Créer le rôle si nécessaire (voir section ci-dessus)

# 2. Créer la base
createdb -U unstuffed1004 truffiere_db

# 3. Initialiser le schéma
psql -U unstuffed1004 -d truffiere_db -f database/init_database.sql

# 4. Vérifier
psql -U unstuffed1004 -d truffiere_db -c "\dt"
```

Accès initial : `admin@truffiere.local` / `admin123`

### Via Docker (recommandé)

Utiliser `docker compose up -d --build` depuis la racine — voir [QUICKSTART.md](../QUICKSTART.md) et [DOCKER.md](../DOCKER.md).

### Restauration depuis un dump complet

```bash
dropdb truffiere_db
createdb -U unstuffed1004 truffiere_db
psql -U unstuffed1004 -d truffiere_db -f chemin/vers/dump_complet.sql
```

---

## 💾 Sauvegardes

```bash
# Dump texte
pg_dump -U unstuffed1004 truffiere_db > truffiere_$(date +%Y%m%d_%H%M%S).sql

# Dump compressé
pg_dump -U unstuffed1004 truffiere_db | gzip > truffiere_$(date +%Y%m%d_%H%M%S).sql.gz

# Restauration compressée
gunzip -c truffiere_YYYYMMDD_HHMMSS.sql.gz | psql -U unstuffed1004 -d truffiere_db
```

Un script `backup-db.sh` est disponible à la racine du projet.

> ⚠️ Ne jamais committer de dumps contenant des données réelles dans le dépôt Git.

---

## 🗄️ Structure de la base

### Tables principales

| Table | Description |
|---|---|
| `users` | Utilisateurs de l'application |
| `parcelles` | Parcelles de l'exploitation (avec géométrie PostGIS) |
| `arbres` | Arbres mycorhizés (avec position géographique) |
| `recoltes` | Récoltes de truffes |
| `interventions` | Interventions sur parcelles/arbres |
| `types_intervention` | Référentiel des types d'intervention |
| `clients` | Clients (module Commercial) |
| `ventes` | Ventes de truffes |
| `commandes` | Commandes clients |
| `commandes_achat_truffes` | Commandes d'achat auprès de fournisseurs |
| `fournisseurs_truffes` | Fournisseurs de truffes |
| `stocks_truffes_achetees` | Stock de truffes achetées |
| `analyse_marge_truffes` | Calcul de marges achat/vente |
| `amendements_ref` | Référentiel des amendements |
| `produits_phyto` | Référentiel des produits phytosanitaires |
| `parametres` | Paramètres de l'exploitation |
| `historique` | Audit trail (trigger `log_historique()`) |
| `audit_trail` | Audit trail applicatif (backend) |
| `refresh_tokens` | Tokens JWT avec rotation |
| `login_attempts` | Tentatives de connexion (sécurité) |
| `security_logs` | Logs sécurité |

### Tables détails interventions

| Table | Type d'intervention |
|---|---|
| `irrigation_details` | Irrigation |
| `taille_details` | Taille |
| `traitement_phyto_details` | Traitements phytosanitaires |
| `amendement_details` | Amendements |
| `travail_sol_details` | Travail du sol |
| `observation_details` | Observations |
| `paillage_details` | Paillage |
| `plantation_details` | Plantations |
| `analyse_sol_details` | Analyses de sol |
| `piegeage_details` | Piégeage |
| `inoculation_details` | Inoculations |

> ℹ️ La table `intervention_details` est également présente (méga-table historique). Les deux patterns coexistent — voir section Dette technique ci-dessous.

### Fonctions PLpgSQL principales

| Fonction | Rôle |
|---|---|
| `check_account_lock(email)` | Vérifie le verrouillage d'un compte |
| `increment_login_failures(email)` | Incrémente les échecs et verrouille après 5 tentatives |
| `reset_login_failures(user_id)` | Réinitialise les compteurs après connexion réussie |
| `revoke_token_chain(token_id, reason)` | Révoque un refresh token et toute sa chaîne |
| `detect_token_reuse(token_hash)` | Détecte une réutilisation de token (attaque possible) |
| `cleanup_expired_tokens()` | Purge les tokens et sessions expirés |
| `log_historique()` | Trigger d'audit trail (INSERT/UPDATE/DELETE) |
| `get_consommation_eau(debut, fin, parcelle_id)` | Calcul de la consommation d'eau par parcelle |

---

## 🔐 Sécurité

### Changement du mot de passe admin

Après la première connexion :
1. Se connecter avec `admin@truffiere.local` / `admin123`
2. **Paramètres** → **Mon Profil** → **Changer le mot de passe**
3. Choisir un mot de passe fort (12+ caractères, majuscules, minuscules, chiffres, symboles)

### Recommandations

- Créer des comptes distincts par utilisateur — ne pas partager le compte admin
- Sauvegarder régulièrement (voir section ci-dessus)
- Ne jamais stocker de dumps de données réelles dans le dépôt Git
- En production : restreindre l'accès PostgreSQL à l'interface réseau interne Docker uniquement

---

## 🔧 Extensions PostGIS

Le dump inclut trois schémas PostGIS : `public` (postgis), `topology` et `tiger` / `tiger_data`.

- **`postgis`** — utilisé activement pour les géométries de parcelles et la position des arbres
- **`topology`** et **`tiger` / `tiger_data`** — non utilisés dans le projet (géocodage US uniquement). Inclus dans le dump car présents sur le serveur de production. Peuvent être ignorés sur un environnement de développement.

Si l'environnement cible ne dispose pas de `postgis_tiger_geocoder`, commenter ou supprimer les lignes correspondantes dans le dump avant import.

---

## 🗺️ Dette technique et roadmap

### Absence de système de migrations

Le projet ne dispose pas de système de versioning du schéma (pas de table `schema_migrations`, pas de fichiers numérotés de type Flyway/Liquibase).

L'`init_database.sql` est un dump complet de production — adapté pour une installation neuve, mais qui rend toute évolution de schéma en production manuelle et risquée.

**Impact :** toute modification de structure (ajout de colonne, nouvelle table, index) doit être appliquée manuellement sur chaque environnement (prod, dev, staging) sans traçabilité automatique.

**Solution cible (roadmap) :**
- Créer un dossier `database/migrations/` avec des fichiers numérotés (`001_init.sql`, `002_add_xxx.sql`, …)
- Ajouter une table `schema_migrations(version, applied_at)` pour suivre les migrations appliquées
- Intégrer un script `migrate.js` ou utiliser un outil léger (node-pg-migrate, db-migrate)

### Duplication `intervention_details` / tables spécialisées

Deux patterns coexistent pour les détails d'interventions (table monolithique `intervention_details` + tables spécialisées par type). Les vues `v_interventions_completes` et `v_irrigations` utilisent `intervention_details`. À unifier progressivement vers les tables spécialisées.

### Vues dupliquées snake_case / camelCase

Des vues en doublon existent (`v_stock_truffes_disponible` / `vstocktruffesdisponible`, etc.) avec des comportements légèrement différents sur les filtres de date. À nettoyer et unifier vers le naming snake_case.

---

## 📊 Informations système

- **SGBD :** PostgreSQL 16.4
- **Extensions :** PostGIS (géométries), fuzzystrmatch
- **Encodage :** UTF-8
- **Version base :** V8
- **Dernière mise à jour :** mai 2026

---

## 🆘 Dépannage

### La base existe déjà
```bash
dropdb truffiere_db
createdb -U unstuffed1004 truffiere_db
psql -U unstuffed1004 -d truffiere_db -f database/init_database.sql
```

### Permission denied
```bash
sudo -u postgres psql
# Puis :
GRANT ALL PRIVILEGES ON DATABASE truffiere_db TO unstuffed1004;
```

### Vérifier l'initialisation
```bash
psql -U unstuffed1004 -d truffiere_db -c "\dt"          # Liste des tables
psql -U unstuffed1004 -d truffiere_db -c "SELECT email, role FROM users;"
```

### Erreur `role "unstuffed1004" does not exist`
Voir la section **Prérequis important** en haut de ce document.

---

*Documentation : [README.md](../README.md) — Architecture : [ARCHITECTURE.md](../ARCHITECTURE.md)*
