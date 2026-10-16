/** Lista as provas abertas para o colaborador; é o caminho de volta depois de "Fazer mais tarde". */
import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { formatDateTime } from '../constants/exam.js';
import BackButton from '../components/BackButton.jsx';

export default function Provas() {
  const { apiUrl, token } = useAuth();
  const [exams, setExams] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${apiUrl}/api/exams/available`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setExams).catch((requestError) => setError(requestError.message));
  }, [apiUrl, token]);

  return <section className="page-section">
    <BackButton fallback="/sistemas" />
    <div className="page-heading"><p className="eyebrow">Avaliação</p><h1>Provas</h1><p>Provas dos seus setores disponíveis para realizar agora.</p></div>
    {error && <p className="alert">{error}</p>}
    {exams && !exams.length && <p className="empty-state">Nenhuma prova disponível no momento.</p>}
    <div className="manual-grid">
      {exams?.map((exam) => <Link key={exam.id} to={`/provas/${exam.id}`} className="manual-card">
        <div className="manual-logo"><ClipboardCheck size={28} /></div>
        <div>
          <h2>{exam.titulo}</h2>
          <p>{exam.descricao || `${exam.question_count} pergunta(s)`}</p>
          <small>Disponível até {formatDateTime(exam.ends_at)}</small>
        </div>
      </Link>)}
    </div>
  </section>;
}
