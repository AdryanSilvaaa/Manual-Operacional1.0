import { useEffect, useState } from 'react';
import CardSistema from '../components/CardSistema.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Sistemas() {
  const { apiUrl, token } = useAuth();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div className="page-heading">
        <p className="eyebrow">Sistemas</p>
        <h1>Escolha um sistema</h1>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : systems.length === 0 ? (
        <p className="empty-state">Nenhum sistema cadastrado ou liberado para este perfil.</p>
      ) : (
        <div className="manual-grid">
          {systems.map((system) => (
            <CardSistema key={system.id} system={system} />
          ))}
        </div>
      )}
    </section>
  );
}
