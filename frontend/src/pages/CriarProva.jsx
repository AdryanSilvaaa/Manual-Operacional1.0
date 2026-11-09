/**
 * Cadastro de prova pelo gerente de setor, editor de conteúdo ou suporte.
 * Gerente escolhe um dos seus setores; suporte e editor de conteúdo escolhem um setor ou todos. Limites e tipos espelham backend/src/utils/exam.js.
 */
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { ALL_SECTOR_ROLES } from '../constants/roles.js';
import BackButton from '../components/BackButton.jsx';
import ExamQuestionsEditor, { newQuestion, serializeQuestions } from '../components/ExamQuestionsEditor.jsx';
import TemplatePicker from '../components/TemplatePicker.jsx';

const ALL_SECTORS = 'todos';
const INITIAL_FORM = { titulo: '', descricao: '', sectorId: ALL_SECTORS, startsAt: '', endsAt: '', templateId: null, saveAsTemplate: false };

export default function CriarProva() {
  const { apiUrl, token, user } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [questions, setQuestions] = useState([newQuestion()]);
  const toast = useToast();
  const [sectors, setSectors] = useState([]);
  const allSectors = ALL_SECTOR_ROLES.includes(user.role);
  const ownSectors = user.setores || [];

  useEffect(() => {
    if (!allSectors) return;
    fetch(`${apiUrl}/api/sectors`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setSectors).catch((requestError) => toast.error(requestError.message));
  }, [apiUrl, token, allSectors, toast]);

  // Setor da prova em número: "todos" não tem setor (e por isso não pode virar modelo, que é sempre de um setor).
  const examSectorId = allSectors
    ? (form.sectorId === ALL_SECTORS ? null : form.sectorId)
    : (ownSectors.length === 1 ? ownSectors[0].id : form.sectorId || null);

  // Preenche título, descrição e perguntas com o modelo escolhido; tudo pode ser ajustado antes de criar.
  function pickTemplate(template) {
    if (!template) { setForm({ ...form, templateId: null }); return; }
    setForm({ ...form, templateId: template.id, titulo: template.titulo, descricao: template.descricao || '' });
    setQuestions(template.editorQuestions);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const { saveAsTemplate, ...fields } = form;
    const payload = {
      ...fields,
      // datetime-local não tem fuso; a conversão usa o horário do computador de quem cria.
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      questions: serializeQuestions(questions)
    };

    try {
      const response = await fetch(`${apiUrl}/api/exams`, { method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify(payload) });
      await readResponse(response);
      if (saveAsTemplate && examSectorId) {
        const templateBody = JSON.stringify({ sectorId: examSectorId, titulo: form.titulo, descricao: form.descricao, questions: payload.questions });
        await readResponse(await fetch(`${apiUrl}/api/exam-templates`, { method: 'POST', headers: createAuthHeaders(token), body: templateBody }))
          .catch((templateError) => toast.error(`Prova criada, mas o modelo não foi salvo: ${templateError.message}`));
      }
      const audience = allSectors && form.sectorId === ALL_SECTORS ? 'de todos os setores' : 'do setor';
      setForm(INITIAL_FORM);
      setQuestions([newQuestion()]);
      toast.success(`Prova criada. Os colaboradores ${audience} serão avisados no período de realização.`);
    } catch (requestError) { toast.error(requestError.message); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar Prova</h1></div>
    <form className="admin-panel manual-form" onSubmit={handleSubmit}>
      <TemplatePicker value={form.templateId} onPick={pickTemplate} />
      {allSectors && <label>Setor<select value={form.sectorId} onChange={(event) => setForm({ ...form, sectorId: event.target.value })}>
        <option value={ALL_SECTORS}>Todos os setores</option>
        {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
      </select></label>}
      {!allSectors && ownSectors.length > 1 && <label>Setor<select value={form.sectorId === ALL_SECTORS ? '' : form.sectorId} onChange={(event) => setForm({ ...form, sectorId: event.target.value })} required>
        <option value="">Selecione</option>
        {ownSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
      </select></label>}
      {!allSectors && ownSectors.length <= 1 && <label>Setor<input value={ownSectors[0]?.nome || 'Usuário sem setor definido'} disabled /></label>}
      <p className="hint">{allSectors && form.sectorId === ALL_SECTORS
        ? 'A prova fica disponível para os colaboradores de todos os setores.'
        : 'A prova fica disponível apenas para os colaboradores deste setor.'}</p>
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição (opcional)<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <div className="exam-period">
        <label>Início<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label>
        <label>Final<input type="datetime-local" value={form.endsAt} min={form.startsAt || undefined} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} required /></label>
      </div>
      <ExamQuestionsEditor questions={questions} onChange={setQuestions} />
      <label className="checkbox-line"><input type="checkbox" checked={form.saveAsTemplate} disabled={!examSectorId} onChange={(event) => setForm({ ...form, saveAsTemplate: event.target.checked })} />Salvar também como modelo de prova</label>
      {!examSectorId && <p className="hint">Para salvar como modelo, escolha um setor: o modelo fica só para o setor que o criou.</p>}
      <button className="primary-button" disabled={!allSectors && !ownSectors.length}><Plus size={18} />Criar prova</button>
    </form>
  </section>;
}
