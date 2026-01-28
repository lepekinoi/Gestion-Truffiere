#!/usr/bin/env python3
"""
Script de migration automatique pour Commercial.js
Transforme le code pour utiliser les composants Phase 1 + 2

Usage:
  python migrate-commercial.py

Auteur: Migration Phase 2
Date: 29 janvier 2026
"""

import re
import os
from pathlib import Path

# Chemins
CURRENT_DIR = Path(__file__).parent
COMMERCIAL_PATH = CURRENT_DIR.parent / 'src' / 'components' / 'Commercial.js'
BACKUP_PATH = CURRENT_DIR.parent / 'src' / 'components' / 'Commercial.js.backup'


def backup_file():
    """Crée une sauvegarde du fichier original"""
    if COMMERCIAL_PATH.exists():
        with open(COMMERCIAL_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        with open(BACKUP_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Sauvegarde créée: {BACKUP_PATH}")
        return content
    else:
        raise FileNotFoundError(f"Fichier introuvable: {COMMERCIAL_PATH}")


def add_imports(content):
    """Ajoute les imports des nouveaux composants"""
    old_import = "import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';"
    
    new_imports = """import { useColumnSettings, COLONNES_CONFIG } from '../hooks/useColumnSettings';

// Imports Phase 2 - Composants UI
import { StatsCard } from './Commercial/components/StatsCard';
import { StatusBadge } from './Commercial/components/StatusBadge';
import { PaginationControls as PaginationControlsComponent } from './Commercial/components/PaginationControls';
import { ClientTile } from './Commercial/components/ClientTile';
import { 
  STATUT_COLORS_COMMANDES as STATUT_COLORS_CMD, 
  STATUT_COLORS_VENTES as STATUT_COLORS_VT 
} from './Commercial/utils/constants';"""
    
    if old_import in content:
        content = content.replace(old_import, new_imports)
        print("✅ Étape 1/7 : Imports ajoutés")
    else:
        print("⚠️  Import pattern introuvable")
    
    return content


def replace_stats_cards(content):
    """Remplace les blocs de stats par StatsCard"""
    
    # Pattern pour Stats Clients (4 cartes)
    stats_clients_pattern = re.compile(
        r'{/\* STATS CLIENTS \*/}\s*<div style={{[^}]+}}>.*?</div>\s*</div>',
        re.DOTALL
    )
    
    stats_clients_replacement = """{
/* STATS CLIENTS */}
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '15px',
  marginBottom: '30px'
}}>
  <StatsCard 
    label="TOTAL"
    value={statsClients.total}
    color="#2196f3"
  />
  <StatsCard 
    label="👤 PARTICULIERS"
    value={statsClients.particuliers}
    color="#4caf50"
  />
  <StatsCard 
    label="🍽️ RESTAURANTS"
    value={statsClients.restaurants}
    color="#ff9800"
  />
  <StatsCard 
    label="📦 GROSSISTES"
    value={statsClients.grossistes}
    color="#9c27b0"
  />
</div>"""
    
    # Pattern pour Stats Commandes
    stats_commandes_replacement = """{
/* STATS COMMANDES */}
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '15px',
  marginBottom: '30px'
}}>
  <StatsCard 
    label="TOTAL"
    value={statsCommandes.total}
    color="#2196f3"
  />
  <StatsCard 
    label="EN ATTENTE"
    value={statsCommandes.enAttente}
    color="#ff9800"
  />
  <StatsCard 
    label="LIVRÉES"
    value={statsCommandes.livrees}
    color="#4caf50"
  />
  <StatsCard 
    label="MONTANT TOTAL"
    value={`${statsCommandes.montantTotal.toFixed(2)} €`}
    color="#9c27b0"
  />
</div>"""
    
    # Pattern pour Stats Ventes
    stats_ventes_replacement = """{
/* STATS VENTES */}
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '15px',
  marginBottom: '30px'
}}>
  <StatsCard 
    label="TOTAL"
    value={statsVentes.total}
    color="#2196f3"
  />
  <StatsCard 
    label="PAYÉES"
    value={statsVentes.payees}
    color="#4caf50"
  />
  <StatsCard 
    label="EN ATTENTE"
    value={statsVentes.enAttente}
    color="#ff9800"
  />
  <StatsCard 
    label="CA"
    value={`${statsVentes.chiffreAffaires.toFixed(2)} €`}
    color="#9c27b0"
  />
</div>"""
    
    # Recherche et remplacement simplifiés avec marqueurs
    if '{/* STATS CLIENTS */}' in content:
        # Trouver le début et la fin du bloc stats clients
        start = content.find('{/* STATS CLIENTS */}')
        # Chercher la div fermante correspondante (4 cartes)
        nested_level = 0
        pos = start
        while pos < len(content):
            if content[pos:pos+5] == '<div ':
                nested_level += 1
            elif content[pos:pos+6] == '</div>':
                nested_level -= 1
                if nested_level == -1:  # Fin du bloc principal
                    end = pos + 6
                    old_block = content[start:end]
                    content = content[:start] + stats_clients_replacement + content[end:]
                    print("✅ Étape 2/7 : Stats Clients remplacées")
                    break
            pos += 1
    
    # Même logique pour Commandes
    if '{/* STATS COMMANDES */}' in content:
        start = content.find('{/* STATS COMMANDES */}')
        nested_level = 0
        pos = start
        while pos < len(content):
            if content[pos:pos+5] == '<div ':
                nested_level += 1
            elif content[pos:pos+6] == '</div>':
                nested_level -= 1
                if nested_level == -1:
                    end = pos + 6
                    content = content[:start] + stats_commandes_replacement + content[end:]
                    print("✅ Étape 3/7 : Stats Commandes remplacées")
                    break
            pos += 1
    
    # Même logique pour Ventes
    if '{/* STATS VENTES */}' in content:
        start = content.find('{/* STATS VENTES */}')
        nested_level = 0
        pos = start
        while pos < len(content):
            if content[pos:pos+5] == '<div ':
                nested_level += 1
            elif content[pos:pos+6] == '</div>':
                nested_level -= 1
                if nested_level == -1:
                    end = pos + 6
                    content = content[:start] + stats_ventes_replacement + content[end:]
                    print("✅ Étape 4/7 : Stats Ventes remplacées")
                    break
            pos += 1
    
    return content


def replace_status_badges_commandes(content):
    """Remplace les badges de statut dans les commandes"""
    
    # Pattern pour les badges commandes
    pattern = r'''<span style={{\s*display: 'inline-block',\s*padding: '[^']+',\s*borderRadius: '[^']+',\s*fontSize: '[^']+',\s*fontWeight: '[^']+',\s*backgroundColor: STATUT_COLORS_COMMANDES\[commande\.statut\]\?\.background[^}]+,\s*color: STATUT_COLORS_COMMANDES\[commande\.statut\]\?\.color[^}]+\s*}}>\s*{commande\.statut}\s*</span>'''
    
    replacement = '''<StatusBadge 
                statut={commande.statut}
                type="commande"
              />'''
    
    count = len(re.findall(pattern, content, re.DOTALL))
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if count > 0:
        print(f"✅ Étape 5/7 : {count} StatusBadge Commandes remplacés")
    
    return content


def replace_status_badges_ventes(content):
    """Remplace les badges de statut dans les ventes"""
    
    # Pattern pour les badges ventes
    pattern = r'''<span style={{\s*display: 'inline-block',\s*padding: '[^']+',\s*borderRadius: '[^']+',\s*fontSize: '[^']+',\s*fontWeight: '[^']+',\s*backgroundColor: STATUT_COLORS_VENTES\[vente\.statut\]\?\.background[^}]+,\s*color: STATUT_COLORS_VENTES\[vente\.statut\]\?\.color[^}]+\s*}}>\s*{vente\.statut}\s*</span>'''
    
    replacement = '''<StatusBadge 
                statut={vente.statut}
                type="vente"
              />'''
    
    count = len(re.findall(pattern, content, re.DOTALL))
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if count > 0:
        print(f"✅ Étape 6/7 : {count} StatusBadge Ventes remplacés")
    
    return content


def replace_pagination_controls(content):
    """Remplace le composant PaginationControls interne par l'importé"""
    
    # Supprimer la définition interne
    pattern = r'const PaginationControls = \({[^}]+}\) => {[^}]+return[^}]+};'
    content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    # Remplacer les utilisations
    content = content.replace('<PaginationControls', '<PaginationControlsComponent')
    content = content.replace('</PaginationControls>', '</PaginationControlsComponent>')
    
    print("✅ Étape 7/7 : PaginationControls remplacé")
    
    return content


def write_file(content):
    """Écrit le contenu modifié dans le fichier"""
    with open(COMMERCIAL_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"\n✅ Fichier mis à jour: {COMMERCIAL_PATH}")


def count_lines(content):
    """Compte le nombre de lignes"""
    return len(content.split('\n'))


def main():
    print("🚀 Démarrage de la migration Commercial.js\n")
    
    # 1. Sauvegarde
    print("[1/8] Création de la sauvegarde...")
    content_before = backup_file()
    lines_before = count_lines(content_before)
    print(f"    Lignes avant migration: {lines_before}\n")
    
    # 2. Transformations
    print("[2/8] Application des transformations...")
    content = content_before
    content = add_imports(content)
    content = replace_stats_cards(content)
    content = replace_status_badges_commandes(content)
    content = replace_status_badges_ventes(content)
    content = replace_pagination_controls(content)
    
    # 3. Écriture
    print("\n[3/8] Écriture du fichier modifié...")
    write_file(content)
    
    # 4. Statistiques
    lines_after = count_lines(content)
    reduction = lines_before - lines_after
    percent = (reduction / lines_before) * 100
    
    print("\n" + "="*50)
    print("🎉 MIGRATION TERMINÉE AVEC SUCCÈS !")
    print("="*50)
    print(f"Lignes avant  : {lines_before}")
    print(f"Lignes après : {lines_after}")
    print(f"Réduction    : {reduction} lignes (-{percent:.1f}%)")
    print("\n📝 Prochaines étapes :")
    print("  1. Tester la compilation : npm start")
    print("  2. Vérifier l'affichage de chaque onglet")
    print("  3. Tester les fonctionnalités (filtres, pagination)")
    print("\n🔙 En cas de problème, restaurer : cp Commercial.js.backup Commercial.js")
    print("="*50)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ ERREUR : {str(e)}")
        print("\nLa sauvegarde est disponible dans Commercial.js.backup")
        raise
