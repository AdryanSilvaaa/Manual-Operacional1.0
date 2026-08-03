/** Lista os manuais visíveis de um sistema; filtros de autorização pertencem ao backend. */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import CardManual from '../components/CardManual.jsx';
import SearchField from '../components/SearchField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { matchesSearch } from '../utils/search.js';

export default function Manuais() {
  const { systemId } = useParams();
  const { apiUrl, token } = useAuth();
  const [manuals, setManuals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Pesquisa somente pelo título, conforme o nome apresentado em cada card.
  const filteredManuals = useMemo(
    () => manuals.filter((manual) => matchesSearch(manual.titulo, searchTerm)),
    [manuals, searchTerm]
  );

  useEffect(() => {
    async function loadManuals() {
      const query = systemId ? `?systemId=${systemId}` : '';
      const response = await fetch(`${apiUrl}/api/manuals${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setManuals(Array.isArray(data) ? data : []);
      setLoading(false);
    }

    loadManuals();
  }, [apiUrl, systemId, token]);

  return (
    <section className="page-section">
      <Link to="/sistemas" className="back-link">
        <ArrowLeft size={18} />
        Voltar para sistemas
      </Link>

      <div className="page-heading">
        <p className="eyebrow">Biblioteca</p>
        <h1>Manuais do sistema</h1>
      </div>

      {!loading && manuals.length > 0 && (
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Pesquisar manual pelo nome"
          label="Pesquisar manuais"
        />
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : manuals.length === 0 ? (
        <p className="empty-state">Ainda não há nenhum manual cadastrado para este sistema em seu setor.</p>
      ) : filteredManuals.length === 0 ? (
        <p className="empty-state">Nenhum manual encontrado para “{searchTerm}”.</p>
      ) : (
        <div className="manual-grid">
          {filteredManuals.map((manual) => (
            <CardManual key={manual.id} manual={manual} />
          ))}
        </div>
      )}
    </section>
  );
}
