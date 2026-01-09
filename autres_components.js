
// ==================== frontend/src/components/Clients.js ====================
function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await axios.get(`${API_URL}/clients`);
      setClients(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Chargement...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>👥 Gestion des clients</h2>
        <button className="btn btn-primary">➕ Nouveau client</button>
      </div>
      {clients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <p>Aucun client enregistré</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Ville</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client.id}>
                <td>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: client.type === 'Particulier' ? '#e3f2fd' : client.type === 'Restaurant' ? '#fff3e0' : '#f3e5f5',
                    color: '#333',
                    fontSize: '0.85rem'
                  }}>
                    {client.type}
                  </span>
                </td>
                <td>
                  <strong>
                    {client.raison_sociale || `${client.nom} ${client.prenom || ''}`}
                  </strong>
                </td>
                <td>{client.email || '-'}</td>
                <td>{client.telephone || '-'}</td>
                <td>{client.ville || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ==================== frontend/src/components/Ventes.js ====================
function Ventes() {
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVentes();
  }, []);

  const loadVentes = async () => {
    try {
      const response = await axios.get(`${API_URL}/ventes`);
      setVentes(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      setLoading(false);
    }
  };

  const totalCA = ventes
    .filter(v => v.statut === 'Payée')
    .reduce((sum, v) => sum + parseFloat(v.montant_total || 0), 0);

  if (loading) return <div className="loading">Chargement...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>💰 Gestion des ventes</h2>
        <button className="btn btn-primary">➕ Nouvelle vente</button>
      </div>

      <div className="card-grid" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="card-title">Total ventes</div>
          <div className="card-value">{ventes.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Chiffre d'affaires</div>
          <div className="card-value">{totalCA.toFixed(2)} €</div>
        </div>
      </div>

      {ventes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <p>Aucune vente enregistrée</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Quantité (g)</th>
              <th>Prix/kg</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {ventes.map(vente => (
              <tr key={vente.id}>
                <td>{new Date(vente.date_vente).toLocaleDateString('fr-FR')}</td>
                <td>{`${vente.client_nom} ${vente.client_prenom || ''}`}</td>
                <td>{parseFloat(vente.quantite_grammes).toFixed(0)} g</td>
                <td>{parseFloat(vente.prix_unitaire_kg).toFixed(2)} €</td>
                <td><strong>{parseFloat(vente.montant_total).toFixed(2)} €</strong></td>
                <td>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: vente.statut === 'Payée' ? '#d4edda' : '#fff3cd',
                    color: vente.statut === 'Payée' ? '#155724' : '#856404',
                    fontSize: '0.85rem'
                  }}>
                    {vente.statut}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ==================== frontend/src/components/Statistiques.js ====================
function Statistiques() {
  const [stats, setStats] = useState({
    parcelles: [],
    arbres: [],
    ventes: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [parcellesRes, arbresRes, ventesRes] = await Promise.all([
        axios.get(`${API_URL}/stats/production-parcelle`),
        axios.get(`${API_URL}/stats/production-arbre`),
        axios.get(`${API_URL}/stats/ventes`)
      ]);
      setStats({
        parcelles: parcellesRes.data,
        arbres: arbresRes.data,
        ventes: ventesRes.data
      });
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Chargement des statistiques...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>📈 Statistiques et analyses</h2>
      </div>

      <h3 style={{ color: '#2c5f2d', marginTop: '2rem' }}>Production par parcelle</h3>
      {stats.parcelles.length === 0 ? (
        <p style={{ color: '#999', padding: '1rem' }}>Aucune donnée disponible</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Parcelle</th>
              <th>Année</th>
              <th>Nb récoltes</th>
              <th>Production (kg)</th>
              <th>Poids moyen (g)</th>
              <th>Valeur (€)</th>
            </tr>
          </thead>
          <tbody>
            {stats.parcelles.map((stat, idx) => (
              <tr key={idx}>
                <td><strong>{stat.parcelle}</strong></td>
                <td>{stat.annee || '-'}</td>
                <td>{stat.nombre_recoltes || 0}</td>
                <td>{stat.poids_total_g ? (stat.poids_total_g / 1000).toFixed(2) : '0.00'} kg</td>
                <td>{stat.poids_moyen_g ? parseFloat(stat.poids_moyen_g).toFixed(0) : '0'} g</td>
                <td>{stat.valeur_totale ? parseFloat(stat.valeur_totale).toFixed(2) : '0.00'} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ color: '#2c5f2d', marginTop: '2rem' }}>Top arbres producteurs</h3>
      {stats.arbres.length === 0 ? (
        <p style={{ color: '#999', padding: '1rem' }}>Aucune donnée disponible</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Espèce</th>
              <th>Parcelle</th>
              <th>Nb récoltes</th>
              <th>Production (kg)</th>
            </tr>
          </thead>
          <tbody>
            {stats.arbres.slice(0, 10).map((stat) => (
              <tr key={stat.id}>
                <td><strong>{stat.numero}</strong></td>
                <td>{stat.espece}</td>
                <td>{stat.parcelle}</td>
                <td>{stat.nombre_recoltes || 0}</td>
                <td>{stat.poids_total_g ? (stat.poids_total_g / 1000).toFixed(2) : '0.00'} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ color: '#2c5f2d', marginTop: '2rem' }}>Chiffre d'affaires mensuel</h3>
      {stats.ventes.length === 0 ? (
        <p style={{ color: '#999', padding: '1rem' }}>Aucune donnée disponible</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Période</th>
              <th>Nb ventes</th>
              <th>Quantité (kg)</th>
              <th>CA (€)</th>
              <th>Prix moyen/kg</th>
            </tr>
          </thead>
          <tbody>
            {stats.ventes.map((stat, idx) => (
              <tr key={idx}>
                <td><strong>{stat.mois}/{stat.annee}</strong></td>
                <td>{stat.nombre_ventes}</td>
                <td>{stat.quantite_vendue_g ? (stat.quantite_vendue_g / 1000).toFixed(2) : '0.00'} kg</td>
                <td>{stat.chiffre_affaires ? parseFloat(stat.chiffre_affaires).toFixed(2) : '0.00'} €</td>
                <td>{stat.prix_moyen_kg ? parseFloat(stat.prix_moyen_kg).toFixed(2) : '0.00'} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Export de tous les composants
export { Arbres, Interventions, Recoltes, Clients, Ventes, Statistiques };