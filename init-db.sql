-- Extension pour les types géographiques
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table des parcelles
CREATE TABLE parcelles (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    surface_ha DECIMAL(10, 2),
    geometrie GEOMETRY(Polygon, 4326), -- Coordonnées GPS
    type_sol VARCHAR(100),
    ph_sol DECIMAL(3, 1),
    exposition VARCHAR(50),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Table des arbres truffiers
CREATE TABLE arbres (
    id SERIAL PRIMARY KEY,
    parcelle_id INTEGER REFERENCES parcelles(id) ON DELETE CASCADE,
    numero VARCHAR(50) UNIQUE NOT NULL,
    espece VARCHAR(100) NOT NULL, -- Chêne vert, chêne pubescent, noisetier...
    variete_truffe VARCHAR(100), -- Tuber melanosporum, Tuber aestivum...
    date_plantation DATE NOT NULL,
    position GEOMETRY(Point, 4326),
    etat VARCHAR(50) DEFAULT 'Bon', -- Bon, Moyen, Mauvais, Mort
    circonference_cm DECIMAL(5, 1),
    hauteur_m DECIMAL(4, 1),
    date_derniere_taille DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des types d'interventions
CREATE TABLE types_intervention (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    couleur VARCHAR(7) -- Code couleur hex pour le planning
);

-- Insertion des types d'interventions par défaut
INSERT INTO types_intervention (nom, description, couleur) VALUES
('Irrigation', 'Arrosage des arbres', '#3498db'),
('Taille', 'Taille des arbres truffiers', '#e74c3c'),
('Travail du sol', 'Labour, binage, griffage', '#f39c12'),
('Amendement', 'Apport de calcaire, compost', '#27ae60'),
('Traitement', 'Traitement phytosanitaire', '#9b59b6'),
('Récolte', 'Cavage des truffes', '#1abc9c'),
('Observation', 'Surveillance et notes', '#95a5a6');

-- Table des interventions planifiées
CREATE TABLE interventions (
    id SERIAL PRIMARY KEY,
    type_intervention_id INTEGER REFERENCES types_intervention(id),
    parcelle_id INTEGER REFERENCES parcelles(id) ON DELETE CASCADE,
    arbre_id INTEGER REFERENCES arbres(id) ON DELETE CASCADE,
    date_prevue DATE NOT NULL,
    date_realisee DATE,
    duree_minutes INTEGER,
    personnel VARCHAR(200),
    description TEXT,
    cout DECIMAL(10, 2),
    statut VARCHAR(20) DEFAULT 'Planifié', -- Planifié, En cours, Terminé, Annulé
    meteo VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des récoltes
CREATE TABLE recoltes (
    id SERIAL PRIMARY KEY,
    parcelle_id INTEGER REFERENCES parcelles(id),
    arbre_id INTEGER REFERENCES arbres(id),
    date_recolte DATE NOT NULL,
    poids_grammes DECIMAL(10, 2) NOT NULL,
    qualite VARCHAR(50), -- Extra, Première, Deuxième, Brossage
    calibre VARCHAR(50), -- Petite, Moyenne, Grosse
    maturite VARCHAR(50), -- Parfaite, Bonne, Moyenne
    profondeur_cm INTEGER,
    prix_kg DECIMAL(10, 2),
    caveur VARCHAR(100),
    chien VARCHAR(100),
    conditions_meteo VARCHAR(200),
    temperature_sol DECIMAL(4, 1),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des clients
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- Particulier, Restaurant, Grossiste
    nom VARCHAR(200) NOT NULL,
    prenom VARCHAR(100),
    raison_sociale VARCHAR(200),
    email VARCHAR(150),
    telephone VARCHAR(20),
    adresse TEXT,
    code_postal VARCHAR(10),
    ville VARCHAR(100),
    pays VARCHAR(100) DEFAULT 'France',
    siret VARCHAR(14),
    notes TEXT,
    date_premier_achat DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des ventes
CREATE TABLE ventes (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    recolte_id INTEGER REFERENCES recoltes(id),
    date_vente DATE NOT NULL,
    quantite_grammes DECIMAL(10, 2) NOT NULL,
    prix_unitaire_kg DECIMAL(10, 2) NOT NULL,
    montant_total DECIMAL(10, 2) NOT NULL,
    mode_paiement VARCHAR(50), -- Espèces, Chèque, Virement, CB
    statut VARCHAR(20) DEFAULT 'En attente', -- En attente, Payée, Annulée
    numero_facture VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour l'historique complet (audit trail)
CREATE TABLE historique (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    user_name VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fonction trigger pour l'historique
CREATE OR REPLACE FUNCTION log_historique()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO historique (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO historique (table_name, record_id, action, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO historique (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Création des triggers pour toutes les tables principales
CREATE TRIGGER arbres_historique AFTER INSERT OR UPDATE OR DELETE ON arbres
    FOR EACH ROW EXECUTE FUNCTION log_historique();

CREATE TRIGGER interventions_historique AFTER INSERT OR UPDATE OR DELETE ON interventions
    FOR EACH ROW EXECUTE FUNCTION log_historique();

CREATE TRIGGER recoltes_historique AFTER INSERT OR UPDATE OR DELETE ON recoltes
    FOR EACH ROW EXECUTE FUNCTION log_historique();

CREATE TRIGGER ventes_historique AFTER INSERT OR UPDATE OR DELETE ON ventes
    FOR EACH ROW EXECUTE FUNCTION log_historique();

-- Vues pour statistiques et rapports

-- Vue statistiques de production par parcelle
CREATE VIEW stats_production_parcelle AS
SELECT 
    p.id,
    p.nom AS parcelle,
    EXTRACT(YEAR FROM r.date_recolte) AS annee,
    COUNT(r.id) AS nombre_recoltes,
    SUM(r.poids_grammes) AS poids_total_g,
    ROUND(AVG(r.poids_grammes), 2) AS poids_moyen_g,
    SUM(r.poids_grammes * r.prix_kg / 1000) AS valeur_totale
FROM parcelles p
LEFT JOIN recoltes r ON p.id = r.parcelle_id
GROUP BY p.id, p.nom, EXTRACT(YEAR FROM r.date_recolte)
ORDER BY annee DESC, poids_total_g DESC;

-- Vue statistiques par arbre
CREATE VIEW stats_production_arbre AS
SELECT 
    a.id,
    a.numero,
    a.espece,
    p.nom AS parcelle,
    COUNT(r.id) AS nombre_recoltes,
    SUM(r.poids_grammes) AS poids_total_g,
    ROUND(AVG(r.poids_grammes), 2) AS poids_moyen_g
FROM arbres a
LEFT JOIN parcelles p ON a.parcelle_id = p.id
LEFT JOIN recoltes r ON a.id = r.arbre_id
GROUP BY a.id, a.numero, a.espece, p.nom
ORDER BY poids_total_g DESC;

-- Vue chiffre d'affaires
CREATE VIEW stats_ventes AS
SELECT 
    EXTRACT(YEAR FROM v.date_vente) AS annee,
    EXTRACT(MONTH FROM v.date_vente) AS mois,
    COUNT(v.id) AS nombre_ventes,
    SUM(v.quantite_grammes) AS quantite_vendue_g,
    SUM(v.montant_total) AS chiffre_affaires,
    ROUND(AVG(v.prix_unitaire_kg), 2) AS prix_moyen_kg
FROM ventes v
WHERE v.statut = 'Payée'
GROUP BY EXTRACT(YEAR FROM v.date_vente), EXTRACT(MONTH FROM v.date_vente)
ORDER BY annee DESC, mois DESC;

-- Index pour optimiser les performances
CREATE INDEX idx_arbres_parcelle ON arbres(parcelle_id);
CREATE INDEX idx_interventions_parcelle ON interventions(parcelle_id);
CREATE INDEX idx_interventions_arbre ON interventions(arbre_id);
CREATE INDEX idx_interventions_date ON interventions(date_prevue);
CREATE INDEX idx_recoltes_parcelle ON recoltes(parcelle_id);
CREATE INDEX idx_recoltes_arbre ON recoltes(arbre_id);
CREATE INDEX idx_recoltes_date ON recoltes(date_recolte);
CREATE INDEX idx_ventes_client ON ventes(client_id);
CREATE INDEX idx_ventes_date ON ventes(date_vente);
CREATE INDEX idx_historique_table_record ON historique(table_name, record_id);

-- Données de démonstration
INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, exposition) VALUES
('Parcelle Nord', 1.5, 'Calcaire', 7.8, 'Sud'),
('Parcelle Sud', 2.3, 'Argilo-calcaire', 8.1, 'Sud-Est'),
('Parcelle Est', 0.8, 'Calcaire', 7.5, 'Ouest');

INSERT INTO arbres (parcelle_id, numero, espece, variete_truffe, date_plantation, etat) VALUES
(1, 'A001', 'Chêne pubescent', 'Tuber melanosporum', '2018-11-15', 'Bon'),
(1, 'A002', 'Chêne vert', 'Tuber melanosporum', '2018-11-15', 'Bon'),
(2, 'B001', 'Noisetier', 'Tuber melanosporum', '2019-03-20', 'Bon'),
(2, 'B002', 'Chêne pubescent', 'Tuber melanosporum', '2019-03-20', 'Moyen');

COMMENT ON DATABASE truffiere IS 'Base de données de gestion de truffière';