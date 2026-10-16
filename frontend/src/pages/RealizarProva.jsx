/** Tela em que o colaborador responde a prova; cada colaborador entrega uma única vez. */
import { useEffect, useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { OPTION_LETTERS, QUESTION_TYPES, formatDateTime } from '../constants/exam.js';
import BackButton from '../components/BackButton.jsx';

export default function RealizarProva() {
  const { id } = useParams();
  const { apiUrl, token } = useAuth();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/api/exams/${id}`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setExam).catch((requestError) => setError(requestError.message));
  }, [apiUrl, id, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!window.confirm('Depois de enviar não é possível alterar as respostas. Enviar a prova?')) return;
    setError('');
    setSending(true);
    try {
      const response = await fetch(`${apiUrl}/api/exams/${id}/submissions`, { method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify({ answers }) });
      await readResponse(response);
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return <section className="page-section"><BackButton fallback="/sistemas" /><p className="manual-complete"><CheckCircle2 size={20} /> Prova enviada. Obrigado!</p></section>;
  }

  return <section className="admin-page">
    <BackButton fallback="/provas" />
    <div className="page-heading"><p className="eyebrow">Prova</p><h1>{exam?.titulo || 'Prova'}</h1>{exam && <p>{exam.descricao ? `${exam.descricao} · ` : ''}Disponível até {formatDateTime(exam.ends_at)}</p>}</div>
    {error && <p className="alert">{error}</p>}
    {exam && <form className="admin-panel manual-form quiz-form" onSubmit={handleSubmit}>
      {exam.questions.map((question, index) => <fieldset key={question.id}>
        <legend>Pergunta {index + 1}</legend>
        <p className="exam-prompt">{question.prompt}</p>
        {question.type === QUESTION_TYPES.OPEN
          ? <textarea aria-label={`Resposta da pergunta ${index + 1}`} value={answers[question.id] || ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} required />
          : question.options.map((option, optionIndex) => <label className="quiz-option" key={optionIndex}>
            <input type="radio" name={`question-${question.id}`} checked={answers[question.id] === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} required />
            <span><strong>{OPTION_LETTERS[optionIndex]})</strong> {option}</span>
          </label>)}
      </fieldset>)}
      <button className="primary-button" disabled={sending}><Send size={18} />{sending ? 'Enviando...' : 'Enviar prova'}</button>
    </form>}
  </section>;
}
