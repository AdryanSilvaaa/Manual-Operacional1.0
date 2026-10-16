/**
 * Cadastro de prova pelo gerente de setor ou suporte.
 * Gerente escolhe um dos seus setores; suporte escolhe um setor ou todos. Limites e tipos espelham backend/src/utils/exam.js.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { ROLES } from '../constants/roles.js';
import { MAX_QUESTIONS, OPTION_LETTERS, QUESTION_TYPES } from '../constants/exam.js';
import BackButton from '../components/BackButton.jsx';

const ALL_SECTORS = 'todos';
const INITIAL_FORM = { titulo: '', descricao: '', sectorId: ALL_SECTORS, startsAt: '', endsAt: '' };

function newQuestion() {
  return { type: QUESTION_TYPES.MULTIPLE_CHOICE, prompt: '', options: ['', '', '', ''], correctOption: 0 };
}

export default function CriarProva() {
  const { apiUrl, token, user } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [questions, setQuestions] = useState([newQuestion()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sectors, setSectors] = useState([]);
  const isSupport = user.role === ROLES.SUPPORT;
  const ownSectors = user.setores || [];

  useEffect(() => {
    if (!isSupport) return;
    fetch(`${apiUrl}/api/sectors`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setSectors).catch((requestError) => setError(requestError.message));
  }, [apiUrl, token, isSupport]);

  function updateQuestion(index, changes) {
    setQuestions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  }

  function updateOption(index, optionIndex, value) {
    setQuestions((current) => current.map((item, itemIndex) => (itemIndex === index
      ? { ...item, options: item.options.map((option, currentIndex) => (currentIndex === optionIndex ? value : option)) }
      : item)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    const payload = {
      ...form,
      // datetime-local não tem fuso; a conversão usa o horário do computador de quem cria.
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      questions: questions.map((question) => (question.type === QUESTION_TYPES.OPEN
        ? { type: question.type, prompt: question.prompt }
        : question))
    };

    try {
      const response = await fetch(`${apiUrl}/api/exams`, { method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify(payload) });
      await readResponse(response);
      const audience = isSupport && form.sectorId === ALL_SECTORS ? 'de todos os setores' : 'do setor';
      setForm(INITIAL_FORM);
      setQuestions([newQuestion()]);
      setMessage(`Prova criada. Os colaboradores ${audience} serão avisados no período de realização.`);
    } catch (requestError) { setError(requestError.message); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar Prova</h1></div>
    {message && <p className="notice">{message}</p>}
    {error && <p className="alert">{error}</p>}
    <form className="admin-panel manual-form" onSubmit={handleSubmit}>
      {isSupport && <label>Setor<select value={form.sectorId} onChange={(event) => setForm({ ...form, sectorId: event.target.value })}>
        <option value={ALL_SECTORS}>Todos os setores</option>
        {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
      </select></label>}
      {!isSupport && ownSectors.length > 1 && <label>Setor<select value={form.sectorId === ALL_SECTORS ? '' : form.sectorId} onChange={(event) => setForm({ ...form, sectorId: event.target.value })} required>
        <option value="">Selecione</option>
        {ownSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
      </select></label>}
      {!isSupport && ownSectors.length <= 1 && <label>Setor<input value={ownSectors[0]?.nome || 'Usuário sem setor definido'} disabled /></label>}
      <p className="hint">{isSupport && form.sectorId === ALL_SECTORS
        ? 'A prova fica disponível para os colaboradores de todos os setores.'
        : 'A prova fica disponível apenas para os colaboradores deste setor.'}</p>
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição (opcional)<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <div className="exam-period">
        <label>Início<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label>
        <label>Final<input type="datetime-local" value={form.endsAt} min={form.startsAt || undefined} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} required /></label>
      </div>
      <fieldset><legend>Perguntas ({questions.length} de {MAX_QUESTIONS})</legend>
        {questions.map((question, index) => <div className="quiz-editor" key={index}>
          <div className="exam-question-header">
            <strong>Pergunta {index + 1}</strong>
            <select aria-label={`Tipo da pergunta ${index + 1}`} value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value })}>
              <option value={QUESTION_TYPES.MULTIPLE_CHOICE}>Múltipla escolha (A a D)</option>
              <option value={QUESTION_TYPES.OPEN}>Resposta aberta</option>
            </select>
          </div>
          <label>Enunciado<textarea value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} required /></label>
          {question.type === QUESTION_TYPES.MULTIPLE_CHOICE && <>
            {question.options.map((option, optionIndex) => <label key={optionIndex}>Alternativa {OPTION_LETTERS[optionIndex]}<input value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} required /></label>)}
            <label>Resposta correta<select value={question.correctOption} onChange={(event) => updateQuestion(index, { correctOption: Number(event.target.value) })}>{OPTION_LETTERS.map((letter, optionIndex) => <option value={optionIndex} key={letter}>Alternativa {letter}</option>)}</select></label>
          </>}
          {question.type === QUESTION_TYPES.OPEN && <p className="hint">O colaborador responde em texto livre. A resposta aparece em Resultados de Provas e não entra na nota.</p>}
          {questions.length > 1 && <button type="button" className="secondary-button" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /> Remover pergunta</button>}
        </div>)}
        {questions.length < MAX_QUESTIONS && <button type="button" className="secondary-button" onClick={() => setQuestions((current) => [...current, newQuestion()])}><Plus size={15} /> Adicionar pergunta</button>}
      </fieldset>
      <button className="primary-button" disabled={!isSupport && !ownSectors.length}><Plus size={18} />Criar prova</button>
    </form>
  </section>;
}
