/** Card de acesso a um manual; altere rota/conteúdo aqui e o visual em styles/pages.css. */
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CardManual({ manual }) {
  const status = manual.completed_at ? 'Concluído' : manual.first_access_at ? 'Em andamento' : 'Pendente';
  const overdue = manual.due_at && !manual.completed_at && new Date(manual.due_at) < new Date();
  return (
    <Link to={`/manuais/${manual.id}`} className="manual-card">
      <div className="manual-logo">
        <FileText size={28} />
      </div>
      <div>
        <h2>{manual.titulo}</h2>
        <p>{manual.descricao || 'Manual operacional disponivel para consulta.'}</p>
        <div className="card-progress"><span>{overdue ? 'Atrasado' : status}</span><strong>{manual.progress_percent || 0}%</strong></div>
        <div className="bar-track"><i style={{ width: `${manual.progress_percent || 0}%` }} /></div>
        {manual.due_at && <small>Prazo: {new Date(manual.due_at).toLocaleDateString('pt-BR')}</small>}
      </div>
    </Link>
  );
}
