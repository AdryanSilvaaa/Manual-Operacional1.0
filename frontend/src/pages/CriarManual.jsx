/**
 * Formulário de upload e vínculo do manual com sistema e setor.
 * Alterar nomes dos campos exige sincronizar middleware/upload.js e manualController.js.
 */
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';

const INITIAL_FORM = { systemId: '', titulo: '', descricao: '', setor: '', dueAt: '', pdf: null, video: null };

/** Envia o material e o associa ao sistema e setor autorizados. */
export default function CriarManual() {
  const { apiUrl, token, user } = useAuth();
  const [systems, setSystems] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState('');
  const [questions, setQuestions] = useState([]);
  const isSectorManager = user?.role === ROLES.SECTOR_MANAGER;

  useEffect(() => {
    async function loadOptions() {
      const headers = createAuthHeaders(token);
      const [systemsResponse, sectorsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/systems`, { headers }), fetch(`${apiUrl}/api/sectors`, { headers })
      ]);
      setSystems(await readResponse(systemsResponse));
      setSectors(await readResponse(sectorsResponse));
    }
    loadOptions().catch((error) => setMessage(error.message));
  }, [apiUrl, token]);

  // Monta o multipart sem forçar Content-Type para preservar o boundary do navegador.
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    payload.append('quiz', JSON.stringify(questions));

    try {
      const response = await fetch(`${apiUrl}/api/manuals`, {
        method: 'POST', headers: createAuthHeaders(token, false), body: payload
      });
      await readResponse(response);
      setForm(INITIAL_FORM);
      setMessage('Manual cadastrado com sucesso.');
      setQuestions([]);
    } catch (error) { setMessage(error.message); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar Manual</h1></div>
    {message && <p className="notice">{message}</p>}
    <form className="admin-panel manual-form" onSubmit={handleSubmit}>
      <label>Sistema<select value={form.systemId} onChange={(event) => setForm({ ...form, systemId: event.target.value })} required><option value="">Selecione</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.nome}</option>)}</select></label>
      {isSectorManager ? <label>Setor<input value={user.setor || 'Seu setor'} disabled /></label> : <label>Setor<input list="sectors" value={form.setor} onChange={(event) => setForm({ ...form, setor: event.target.value })} required /><datalist id="sectors">{sectors.map((sector) => <option key={sector.id} value={sector.nome} />)}</datalist></label>}
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <label>Prazo para conclusão (opcional)<input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} /></label>
      <label>PDF<input type="file" accept="application/pdf" onChange={(event) => setForm({ ...form, pdf: event.target.files[0] })} required /></label>
      <label>Vídeo<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => setForm({ ...form, video: event.target.files[0] })} required /></label>
      <fieldset><legend>Questionário (opcional)</legend><p className="hint">Aprovação com nota mínima de 70%.</p>
        {questions.map((question, index) => <div className="quiz-editor" key={index}>
          <label>Pergunta<input value={question.prompt} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} required /></label>
          {question.options.map((option, optionIndex) => <label key={optionIndex}>Alternativa {optionIndex + 1}<input value={option} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: item.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) } : item))} required /></label>)}
          <label>Resposta correta<select value={question.correctOption} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctOption: Number(event.target.value) } : item))}>{question.options.map((_, optionIndex) => <option value={optionIndex} key={optionIndex}>Alternativa {optionIndex + 1}</option>)}</select></label>
          <button type="button" className="secondary-button" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover pergunta</button>
        </div>)}
        <button type="button" className="secondary-button" onClick={() => setQuestions((current) => [...current, { prompt: '', options: ['', '', '', ''], correctOption: 0 }])}>Adicionar pergunta</button>
      </fieldset>
      <button className="primary-button"><Plus size={18} />Cadastrar manual</button>
    </form>
  </section>;
}
