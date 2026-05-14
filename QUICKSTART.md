# ⚡ Quickstart — Gestion-Truffière v8

> Démarrage en 4 étapes avec Docker — moins de 5 minutes

→ Installation sans Docker (développement local) : voir [SETUP.md](SETUP.md)  
→ Guide Docker complet : voir [DOCKER.md](DOCKER.md)

---

## Prérequis

```bash
docker --version          # >= 24.x
docker compose version    # >= 2.x
git --version
```

---

## Étape 1 — Cloner

```bash
git clone https://github.com/lepekinoi/Gestion-Truffiere.git
cd Gestion-Truffiere
git checkout V8
```

---

## Étape 2 — Configurer

```bash
# Copier le template d'environnement dans le dossier backend
cp .env.exemple backend/.env
```

Éditer `backend/.env` — variables **obligatoires** :

```env
DATABASE_PASSWORD=<mot_de_passe_fort>

# Générer deux secrets distincts :
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64_octets_hex>
JWT_REFRESH_SECRET=<64_octets_hex>

JWT_EXPIRATION=15m          # ne pas modifier — politique sécurité V8
JWT_REFRESH_EXPIRATION=7d
CORS_ORIGIN=http://localhost:3000
```

---

## Étape 3 — Lancer

```bash
docker compose up -d --build
```

Premier démarrage : Docker construit les images et `database/init_database.sql`  
est automatiquement exécuté pour initialiser le schéma PostgreSQL.

---

## Étape 4 — Vérifier

```bash
# État des conteneurs
docker compose ps
# Les trois services (db, backend, frontend) doivent être "Up"

# Santé de l'API
curl http://localhost:5000/api/health
# Réponse attendue : {"status":"ok"}
```

Accéder à l'application : **http://localhost:3000**

Connexion initiale :
- **Email** : `admin@truffiere.local`
- **Mot de passe** : `admin123`
- ⚠️ Changer le mot de passe immédiatement : Paramètres → Mon profil → Modifier le mot de passe

---

## Modules disponibles

| Module | Fonction |
|--------|----------|
| Dashboard | Statistiques temps réel, alertes |
| Parcelles | Gestion des parcelles truffières |
| Arbres | Suivi individuel des arbres |
| Récoltes | Enregistrement et historique |
| Interventions | Journal des interventions |
| Commercial | Clients, ventes, commandes |
| Cartographie | Carte Leaflet interactive |
| Statistiques | Graphiques et analyses |
| Historique | Audit trail complet |
| Paramètres | Configuration de l'application |
| Import CSV | Import en masse de données |

---

## Commandes utiles

```bash
# Logs en temps réel
docker compose logs -f backend
docker compose logs -f frontend

# Redémarrer un service
docker compose restart backend

# Accès à la base PostgreSQL
docker compose exec db psql -U truffiere -d gestion_truffiere

# Arrêter (données conservées)
docker compose down

# Arrêter ET supprimer les données — ⚠️ irréversible
docker compose down -v
```

---

## Dépannage rapide

| Symptôme | Vérification |
|----------|--------------|
| API ne répond pas | `docker compose logs backend` |
| Erreur connexion DB | `docker compose ps` → db doit être `healthy` |
| Erreur CORS | `CORS_ORIGIN` dans `backend/.env` doit correspondre à l'URL frontend |
| Frontend blanc | `docker compose logs frontend` + vérifier `REACT_APP_API_URL` |
| Port occupé | `lsof -i :5000` ou `lsof -i :3000` |

Pour un diagnostic approfondi → [DOCKER.md](DOCKER.md)  
Pour les codes d'erreur API → [backend/docs/API_ERROR_CODES.md](backend/docs/API_ERROR_CODES.md)

---

*Dernière mise à jour : mai 2026 — V8*
