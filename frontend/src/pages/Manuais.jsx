import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import CardManual from '../components/CardManual.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Manuais() {
  const { systemId } = useParams();
  const { apiUrl, token } = useAuth();
  const [manuals, setManuals] = useState([]);
  const [loading, setLoading] = useState(true);

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

      {loading ? (
        <p>Carregando...</p>
      ) : manuals.length === 0 ? (
        <p className="empty-state">Ainda não há nenhum manual cadastrado para este sistema em seu setor.</p>
      ) : (
        <div className="manual-grid">
          {manuals.map((manual) => (
            <CardManual key={manual.id} manual={manual} />
          ))}
        </div>
      )}
    </section>
  );
}
