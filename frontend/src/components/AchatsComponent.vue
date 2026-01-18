<template>
  <div class="achats-container">
    <!-- En-tête -->
    <div class="header">
      <h1>🛒 Gestion des Achats de Truffes</h1>
      <button @click="showFournisseurForm = true" class="btn btn-primary">
        ➕ Nouveau Fournisseur
      </button>
    </div>

    <!-- Tabs de navigation -->
    <div class="tabs">
      <button 
        @click="activeTab = 'fournisseurs'"
        :class="{ active: activeTab === 'fournisseurs' }"
        class="tab-btn"
      >
        👥 Fournisseurs
      </button>
      <button 
        @click="activeTab = 'commandes'"
        :class="{ active: activeTab === 'commandes' }"
        class="tab-btn"
      >
        📦 Commandes
      </button>
      <button 
        @click="activeTab = 'stock'"
        :class="{ active: activeTab === 'stock' }"
        class="tab-btn"
      >
        📊 Stock
      </button>
      <button 
        @click="activeTab = 'marge'"
        :class="{ active: activeTab === 'marge' }"
        class="tab-btn"
      >
        💰 Marge
      </button>
    </div>

    <!-- ONGLET: FOURNISSEURS -->
    <div v-if="activeTab === 'fournisseurs'" class="tab-content">
      <div class="filters">
        <input 
          v-model="searchFournisseur" 
          placeholder="Rechercher fournisseur..." 
          class="input"
        />
        <select v-model="filterZone" class="select">
          <option value="">Toutes zones</option>
          <option value="Drôme">Drôme</option>
          <option value="Vaucluse">Vaucluse</option>
          <option value="Var">Var</option>
          <option value="Alpes-de-Haute-Provence">Alpes-de-Haute-Provence</option>
        </select>
        <select v-model="filterStatut" class="select">
          <option value="">Tous statuts</option>
          <option value="Actif">Actif</option>
          <option value="Inactif">Inactif</option>
          <option value="Suspendu">Suspendu</option>
        </select>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Zone</th>
            <th>Contact</th>
            <th>Statut</th>
            <th>Note</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in fournisseurs" :key="f.id" class="table-row">
            <td>{{ f.nom }}</td>
            <td>{{ f.zone_production }}</td>
            <td>{{ f.email }}</td>
            <td>
              <span :class="`badge badge-${f.statut.toLowerCase()}`">
                {{ f.statut }}
              </span>
            </td>
            <td>
              <span v-if="f.statistiques?.note_moyenne">
                ⭐ {{ f.statistiques.note_moyenne.toFixed(1) }}/5
              </span>
              <span v-else>-</span>
            </td>
            <td>
              <button @click="viewFournisseur(f)" class="btn-sm">👁️</button>
              <button @click="editFournisseur(f)" class="btn-sm">✏️</button>
              <button @click="deleteFournisseur(f.id)" class="btn-sm btn-danger">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination">
        <button @click="pageFournisseur--" :disabled="pageFournisseur === 1">←</button>
        <span>Page {{ pageFournisseur }}</span>
        <button @click="pageFournisseur++">→</button>
      </div>
    </div>

    <!-- ONGLET: COMMANDES -->
    <div v-if="activeTab === 'commandes'" class="tab-content">
      <div class="action-bar">
        <button @click="showCommandeForm = true" class="btn btn-primary">
          ➕ Nouvelle Commande
        </button>
      </div>

      <div class="filters">
        <select v-model="filterCommandeStatut" class="select">
          <option value="">Tous statuts</option>
          <option value="En attente">En attente</option>
          <option value="Confirmée">Confirmée</option>
          <option value="Expédiée">Expédiée</option>
          <option value="Livrée">Livrée</option>
          <option value="Réceptionnée">Réceptionnée</option>
        </select>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Fournisseur</th>
            <th>Date</th>
            <th>Livraison prévue</th>
            <th>Montant</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in commandes" :key="c.id" class="table-row">
            <td>{{ c.numero_commande }}</td>
            <td>{{ c.fournisseur_nom }}</td>
            <td>{{ formatDate(c.date_commande) }}</td>
            <td>{{ formatDate(c.date_livraison_prevue) }}</td>
            <td>{{ formatCurrency(c.montant_total) }}</td>
            <td>
              <span :class="`badge badge-${getStatusClass(c.statut)}`">
                {{ c.statut }}
              </span>
            </td>
            <td>
              <button @click="viewCommande(c)" class="btn-sm">👁️</button>
              <button 
                @click="confirmerCommande(c.id)" 
                v-if="c.statut === 'En attente'"
                class="btn-sm btn-success"
              >
                ✓
              </button>
              <button 
                @click="receptionnerCommande(c.id)" 
                v-if="c.statut === 'Livrée'"
                class="btn-sm btn-info"
              >
                📥
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ONGLET: STOCK -->
    <div v-if="activeTab === 'stock'" class="tab-content">
      <div class="stock-summary">
        <div class="stat-card">
          <div class="stat-value">{{ totalStockKg.toFixed(1) }} kg</div>
          <div class="stat-label">Stock total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stockLots.length }}</div>
          <div class="stat-label">Lots en stock</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stockAlerte.length }}</div>
          <div class="stat-label">⚠️ Dates limites approchant</div>
        </div>
      </div>

      <div class="filters">
        <select v-model="filterCalibre" class="select">
          <option value="">Tous calibres</option>
          <option value="20">Extra (20-30mm)</option>
          <option value="30">1ère (30-50mm)</option>
          <option value="50">2e (>50mm)</option>
        </select>
        <select v-model="filterQualite" class="select">
          <option value="">Toutes qualités</option>
          <option value="Extra">Extra</option>
          <option value="1ère">1ère</option>
          <option value="2e">2e</option>
        </select>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Calibre</th>
            <th>Qualité</th>
            <th>Maturité</th>
            <th>Quantité (kg)</th>
            <th>Conservation</th>
            <th>Localisation</th>
            <th>Limite consommation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in stockLots" :key="s.id" class="table-row">
            <td>{{ s.calibre_mm }}mm</td>
            <td>{{ s.qualite }}</td>
            <td>{{ s.maturite }}</td>
            <td>{{ s.quantite_kg_stock }} kg</td>
            <td>{{ s.conservation }}</td>
            <td>{{ s.localisation_storage }}</td>
            <td>
              <span v-if="s.date_limite_consommation" class="date-limit">
                {{ formatDate(s.date_limite_consommation) }}
              </span>
            </td>
            <td>
              <button @click="editStock(s)" class="btn-sm">✏️</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Alertes stocks -->
      <div v-if="stockAlerte.length > 0" class="alert alert-warning">
        <h3>⚠️ Dates limites approchant</h3>
        <ul>
          <li v-for="s in stockAlerte" :key="s.id">
            {{ s.calibre_mm }}mm - {{ s.qualite }} - {{ s.maturite }}: 
            {{ s.jours_avant_limite }} jours ({{ formatDate(s.date_limite_consommation) }})
          </li>
        </ul>
      </div>
    </div>

    <!-- ONGLET: MARGE -->
    <div v-if="activeTab === 'marge'" class="tab-content">
      <div class="marge-summary">
        <div class="stat-card">
          <div class="stat-value">{{ formatCurrency(margeGlobale.marge_totale_euros) }}</div>
          <div class="stat-label">Marge totale (mois)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ margeGlobale.pourcentage_marge_moyen?.toFixed(1) }}%</div>
          <div class="stat-label">% Marge moyen</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ margeGlobale.nb_transactions }}</div>
          <div class="stat-label">Transactions</div>
        </div>
      </div>

      <h3>Marge par calibre</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Calibre</th>
            <th>Qualité</th>
            <th>Maturité</th>
            <th>Nb transactions</th>
            <th>Prix achat moyen</th>
            <th>Prix vente moyen</th>
            <th>Marge moyenne</th>
            <th>% Marge</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in margeParCalibre" :key="`${m.calibre_mm}-${m.qualite}-${m.maturite}`">
            <td>{{ m.calibre_mm }}mm</td>
            <td>{{ m.qualite }}</td>
            <td>{{ m.maturite }}</td>
            <td>{{ m.nombre_transactions }}</td>
            <td>{{ formatCurrency(m.prix_achat_moyen) }}/kg</td>
            <td>{{ formatCurrency(m.prix_vente_moyen) }}/kg</td>
            <td>{{ formatCurrency(m.marge_moyenne_kg) }}/kg</td>
            <td class="text-success">{{ m.pourcentage_marge_moyen?.toFixed(1) }}%</td>
          </tr>
        </tbody>
      </table>

      <h3>Fournisseurs - Rentabilité</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Fournisseur</th>
            <th>Zone</th>
            <th>Transactions</th>
            <th>Marge totale</th>
            <th>% Marge moyen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in fournisseurRentabilite" :key="f.id">
            <td>{{ f.nom }}</td>
            <td>{{ f.zone_production }}</td>
            <td>{{ f.nb_transactions }}</td>
            <td>{{ formatCurrency(f.marge_totale_euros) }}</td>
            <td class="text-success">{{ f.pourcentage_marge_moyen?.toFixed(1) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Formulaire Fournisseur -->
    <div v-if="showFournisseurForm" class="modal">
      <div class="modal-content">
        <h2>{{ editingFournisseur ? 'Modifier Fournisseur' : 'Nouveau Fournisseur' }}</h2>
        
        <form @submit.prevent="saveFournisseur">
          <div class="form-group">
            <label>Nom *</label>
            <input v-model="formFournisseur.nom" class="input" required />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input v-model="formFournisseur.email" type="email" class="input" />
            </div>
            <div class="form-group">
              <label>Téléphone</label>
              <input v-model="formFournisseur.telephone" class="input" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Zone production</label>
              <select v-model="formFournisseur.zone_production" class="select">
                <option>Drôme</option>
                <option>Vaucluse</option>
                <option>Var</option>
                <option>Alpes-de-Haute-Provence</option>
              </select>
            </div>
            <div class="form-group">
              <label>Certifications</label>
              <input v-model="formFournisseur.certifications" class="input" />
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Enregistrer</button>
            <button type="button" @click="showFournisseurForm = false" class="btn btn-secondary">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import AchatsAPI from '@/api/achats.api';

export default defineComponent({
  name: 'AchatsComponent',
  data() {
    return {
      activeTab: 'fournisseurs',
      
      // Fournisseurs
      fournisseurs: [],
      pageFournisseur: 1,
      searchFournisseur: '',
      filterZone: '',
      filterStatut: '',
      
      // Commandes
      commandes: [],
      filterCommandeStatut: '',
      
      // Stock
      stockLots: [],
      stockAlerte: [],
      totalStockKg: 0,
      filterCalibre: '',
      filterQualite: '',
      
      // Marge
      margeGlobale: {},
      margeParCalibre: [],
      fournisseurRentabilite: [],
      
      // Forms
      showFournisseurForm: false,
      showCommandeForm: false,
      editingFournisseur: null,
      formFournisseur: {
        nom: '',
        email: '',
        telephone: '',
        zone_production: '',
        certifications: ''
      }
    };
  },
  
  watch: {
    searchFournisseur() {
      this.pageFournisseur = 1;
      this.loadFournisseurs();
    },
    filterZone() {
      this.loadFournisseurs();
    },
    filterStatut() {
      this.loadFournisseurs();
    },
    activeTab(newTab) {
      if (newTab === 'commandes') {
        this.loadCommandes();
      } else if (newTab === 'stock') {
        this.loadStock();
      } else if (newTab === 'marge') {
        this.loadMarge();
      }
    }
  },

  methods: {
    async loadFournisseurs() {
      try {
        const data = await AchatsAPI.getFournisseurs({
          page: this.pageFournisseur,
          search: this.searchFournisseur,
          zone_production: this.filterZone,
          statut: this.filterStatut
        });
        this.fournisseurs = data.data;
      } catch (error) {
        console.error('Erreur chargement fournisseurs:', error);
      }
    },

    async loadCommandes() {
      try {
        const data = await AchatsAPI.getCommandes({
          statut: this.filterCommandeStatut
        });
        this.commandes = data.data;
      } catch (error) {
        console.error('Erreur chargement commandes:', error);
      }
    },

    async loadStock() {
      try {
        const data = await AchatsAPI.getStockDisponible({
          calibre_mm: this.filterCalibre,
          qualite: this.filterQualite
        });
        this.stockLots = data.data;
        this.totalStockKg = data.data.reduce((sum, s) => sum + parseFloat(s.quantite_totale_kg || 0), 0);
        
        // Load alertes
        const alertes = await AchatsAPI.getStockAlerte();
        this.stockAlerte = alertes.data;
      } catch (error) {
        console.error('Erreur chargement stock:', error);
      }
    },

    async loadMarge() {
      try {
        const marge = await AchatsAPI.getMargeGlobale();
        this.margeGlobale = marge;
        
        const calibres = await AchatsAPI.getMargeParCalibre();
        this.margeParCalibre = calibres.data;
        
        const fournisseurs = await AchatsAPI.getFournisseurRentabilite();
        this.fournisseurRentabilite = fournisseurs.data;
      } catch (error) {
        console.error('Erreur chargement marge:', error);
      }
    },

    async saveFournisseur() {
      try {
        if (this.editingFournisseur) {
          await AchatsAPI.updateFournisseur(this.editingFournisseur.id, this.formFournisseur);
        } else {
          await AchatsAPI.createFournisseur(this.formFournisseur);
        }
        this.showFournisseurForm = false;
        this.resetFournisseurForm();
        this.loadFournisseurs();
      } catch (error) {
        console.error('Erreur sauvegarde fournisseur:', error);
      }
    },

    editFournisseur(fournisseur) {
      this.editingFournisseur = fournisseur;
      this.formFournisseur = { ...fournisseur };
      this.showFournisseurForm = true;
    },

    resetFournisseurForm() {
      this.editingFournisseur = null;
      this.formFournisseur = {
        nom: '',
        email: '',
        telephone: '',
        zone_production: '',
        certifications: ''
      };
    },

    async deleteFournisseur(id) {
      if (confirm('Confirmer suppression?')) {
        await AchatsAPI.deleteFournisseur(id);
        this.loadFournisseurs();
      }
    },

    async confirmerCommande(id) {
      await AchatsAPI.confirmerCommande(id);
      this.loadCommandes();
    },

    viewFournisseur(fournisseur) {
      console.log('Fournisseur:', fournisseur);
    },

    viewCommande(commande) {
      console.log('Commande:', commande);
    },

    editStock(stock) {
      console.log('Stock:', stock);
    },

    receptionnerCommande(id) {
      console.log('Réceptionner commande:', id);
    },

    formatDate(date) {
      return date ? new Date(date).toLocaleDateString('fr-FR') : '-';
    },

    formatCurrency(value) {
      return value ? `${parseFloat(value).toFixed(2)}€` : '0€';
    },

    getStatusClass(statut) {
      const classes = {
        'En attente': 'warning',
        'Confirmée': 'info',
        'Expédiée': 'info',
        'Livrée': 'success',
        'Réceptionnée': 'success',
        'Annulée': 'danger'
      };
      return classes[statut] || 'default';
    }
  },

  mounted() {
    this.loadFournisseurs();
  }
});
</script>

<style scoped>
.achats-container {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.tab-btn {
  padding: 10px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
}

.tab-btn.active {
  border-bottom-color: #3182ce;
  color: #3182ce;
}

.tab-content {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.input, .select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.table th {
  background: #f5f5f5;
  padding: 12px;
  text-align: left;
  font-weight: 600;
}

.table td {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.table-row:hover {
  background: #f9f9f9;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-primary {
  background: #3182ce;
  color: white;
}

.btn-primary:hover {
  background: #2c5aa0;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-danger {
  background: #f56565;
  color: white;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
  margin-right: 4px;
}

.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge-actif {
  background: #c6f6d5;
  color: #22543d;
}

.badge-inactif {
  background: #fed7d7;
  color: #742a2a;
}

.badge-suspendu {
  background: #feebc8;
  color: #7c2d12;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #3182ce;
}

.stat-label {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.alert {
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.alert-warning {
  background: #fffaf0;
  border: 1px solid #fbd38d;
  color: #7c2d12;
}

.text-success {
  color: #22863a;
}

.text-danger {
  color: #f85149;
}
</style>