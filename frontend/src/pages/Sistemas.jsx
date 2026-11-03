/** Lista os sistemas disponíveis; cards mudam em CardSistema.jsx e a API no backend. */
import { useEffect, useMemo, useState } from 'react';
import CardSistema from '../components/CardSistema.jsx';
import BackButton from '../components/BackButton.jsx';
import SearchField from '../components/SearchField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { matchesSearch } from '../utils/search.js';

export default function Sistemas() {
  const { apiUrl, token } = useAuth();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Mantém os dados recebidos intactos e deriva somente os cards visíveis.
  const filteredSystems = useMemo(
    () => systems.filter((system) => matchesSearch(system.nome, searchTerm)),
    [searchTerm, systems]
  );

  useEffect(() => {
    async function loadSystems() {
      const response = await fetch(`${apiUrl}/api/systems`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSystems(Array.isArray(data) ? data : []);
      setLoading(false);
    }

    loadSystems();
  }, [apiUrl, token]);

  return (
    <section className="page-section">
      <BackButton fallback="/" />
      <div className="page-heading">
        <p className="eyebrow">Sistemas</p>
        <h1>Escolha um sistema</h1>
      </div>

      {!loading && systems.length > 0 && (
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Pesquisar sistema pelo nome"
          label="Pesquisar sistemas"
        />
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : systems.length === 0 ? (
        <p className="empty-state">Nenhum sistema cadastrado ou liberado para este perfil.</p>
      ) : filteredSystems.length === 0 ? (
        <p className="empty-state">Nenhum sistema encontrado para “{searchTerm}”.</p>
      ) : (
        <div className="manual-grid">
          {filteredSystems.map((system) => (
            <CardSistema key={system.id} system={system} />
          ))}
        </div>
      )}
    </section>
  );
}
