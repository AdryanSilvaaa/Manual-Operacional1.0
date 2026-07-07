import { useEffect, useState } from 'react';
import CardManual from '../components/CardManual.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Manuais() {
  const { apiUrl, token } = useAuth();
  const [manuals, setManuals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadManuals() {
      const response = await fetch(`${apiUrl}/api/manuals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setManuals(Array.isArray(data) ? data : []);
      setLoading(false);
    }

    loadManuals();
  }, [apiUrl, token]);

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Biblioteca</p>
        <h1>Manuais liberados</h1>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : manuals.length === 0 ? (
        <p className="empty-state">Nenhum manual liberado para este perfil.</p>
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
