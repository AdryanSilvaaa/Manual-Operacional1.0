import { Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CardSistema({ system }) {
  return (
    <Link to={`/sistemas/${system.id}/manuais`} className="manual-card">
      <div className="manual-logo system-logo">
        <Boxes size={28} />
      </div>
      <div>
        <h2>{system.nome}</h2>
        <p>{system.resumo || 'Sistema com manuais operacionais disponiveis.'}</p>
        <span className="card-meta">{system.manuals_count || 0} manuais vinculados</span>
      </div>
    </Link>
  );
}
