/** Card de acesso a um manual; altere rota/conteúdo aqui e o visual em styles/pages.css. */
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CardManual({ manual }) {
  return (
    <Link to={`/manuais/${manual.id}`} className="manual-card">
      <div className="manual-logo">
        <FileText size={28} />
      </div>
      <div>
        <h2>{manual.titulo}</h2>
        <p>{manual.descricao || 'Manual operacional disponivel para consulta.'}</p>
      </div>
    </Link>
  );
}
