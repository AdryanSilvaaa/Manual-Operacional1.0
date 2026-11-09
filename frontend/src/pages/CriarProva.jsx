/**
 * Cadastro de prova pelo gerente de setor, editor de conteúdo ou suporte.
 * Gerente escolhe um dos seus setores; suporte e editor de conteúdo escolhem um setor ou todos. Limites e tipos espelham backend/src/utils/exam.js.
 * É a única tela que aplica provas: para o setor todo ou para colaboradores específicos (ex.: quem acabou de entrar).
 * Modelos de Prova abre esta tela com ?modelo=ID para aplicar um modelo.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { ALL_SECTOR_ROLES } from '../constants/roles.js';
import BackButton from '../components/BackButton.jsx';
import ExamQuestionsEditor, { newQuestion, serializeQuestions, templateQuestionsToEditor } from '../components/ExamQuestionsEditor.jsx';
import TemplatePicker from '../components/TemplatePicker.jsx';
import SearchField from '../components/SearchField.jsx';
import { matchesSearch } from '../utils/search.js';

const ALL_SECTORS = 'todos';
const INITIAL_FORM = { titulo: '', descricao: '', sectorId: ALL_SECTORS, startsAt: '', endsAt: '', templateId: null, saveAsTemplate: false, audience: 'setor', userIds: [] };

export default function CriarProva() {
  const { apiUrl, token, user } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [questions, setQuestions] = useState([newQuestion()]);
  const toast = useToast();
  const [sectors, setSectors] = useState([]);
  const allSectors = ALL_SECTOR_ROLES.includes(user.role);
  const ownSectors = user.setores || [];
  const [searchParams, setSearchParams] = useSearchParams();
  const [collaborators, setCollaborators] = useState([]);
  const [collaboratorFilter, setCollaboratorFilter] = useState('');

  useEffect(() => {
    if (!allSectors) return;
    fetch(`${apiUrl}/api/sectors`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setSectors).catch((requestError) => toast.error(requestError.message));
  }, [apiUrl, token, allSectors, toast]);

  // Setor da prova em número: "todos" não tem setor (e por isso não pode virar modelo, que é sempre de um setor).
  const examSectorId = allSectors
    ? (form.sectorId === ALL_SECTORS ? null : form.sectorId)
    : (ownSectors.length === 1 ? ownSectors[0].id : form.sectorId || null);

  // Colaboradores do setor escolhido, para aplicar só a algumas pessoas.
  useEffect(() => {
    setCollaborators([]);
    if (!examSectorId) return;
    fetch(`${apiUrl}/api/exams/collaborators?sectorId=${examSectorId}`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setCollaborators).catch(() => setCollaborators([]));
  }, [apiUrl, token, examSectorId]);

  // Preenche título, descrição e perguntas com o modelo escolhido (e o setor dele); tudo pode ser ajustado antes de criar.
  function pickTemplate(template) {
    if (!template) { setForm((current) => ({ ...current, templateId: null })); return; }
    const canChooseSector = allSectors || ownSectors.length > 1;
    setForm((current) => ({
      ...current,
      templateId: template.id,
      titulo: template.titulo,
      descricao: template.descricao || '',
      ...(canChooseSector ? { sectorId: String(template.sector_id), userIds: [] } : {})
    }));
    setQuestions(template.editorQuestions);
  }

  // Vindo de Modelos de Prova > Aplicar: carrega o modelo uma vez e limpa o parâmetro da URL.
  const templateFromUrl = searchParams.get('modelo');
  useEffect(() => {
    if (!templateFromUrl) return;
    fetch(`${apiUrl}/api/exam-templates/${templateFromUrl}`, { headers: createAuthHeaders(token) })
      .then(readResponse)
      .then((template) => pickTemplate({ ...template, editorQuestions: templateQuestionsToEditor(template.questions) }))
      .catch((requestError) => toast.error(requestError.message))
      .finally(() => setSearchParams({}, { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateFromUrl]);

  const visibleCollaborators = useMemo(
    () => collaborators.filter((item) => matchesSearch(item.nome, collaboratorFilter)),
    [collaborators, collaboratorFilter]
  );

  function toggleCollaborator(id) {
    setForm((current) => ({ ...current, userIds: current.userIds.includes(id) ? current.userIds.filter((item) => item !== id) : [...current.userIds, id] }));
  }

  const forSomeone = form.audience === 'colaboradores' && Boolean(examSectorId);

  async function handleSubmit(event) {
    event.preventDefault();
    if (forSomeone && !form.userIds.length) { toast.error('Escolha pelo menos um colaborador.'); return; }
    const { saveAsTemplate, userIds, ...fields } = form;
    const payload = {
      ...fields,
      audience: forSomeone ? 'colaboradores' : 'setor',
      userIds: forSomeone ? userIds : [],
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
      const audience = forSomeone ? `${userIds.length} colaborador(es) escolhido(s)` : allSectors && form.sectorId === ALL_SECTORS ? 'os colaboradores de todos os setores' : 'os colaboradores do setor';
      setForm(INITIAL_FORM);
      setQuestions([newQuestion()]);
      toast.success(`Prova criada. ${audience[0].toUpperCase()}${audience.slice(1)} serão avisados no período de realização.`);
    } catch (requestError) { toast.error(requestError.message); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar Prova</h1></div>
    <form className="admin-panel manual-form" onSubmit={handleSubmit}>
      <TemplatePicker value={form.templateId} onPick={pickTemplate} />
      {allSectors && <label>Setor<select value={form.sectorId} onChange={(event) => setForm({ ...form, sectorId: event.target.value, userIds: [] })}>
        <option value={ALL_SECTORS}>Todos os setores</option>
        {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
      </select></label>}
      {!allSectors && ownSectors.length > 1 && <label>Setor<select value={form.sectorId === ALL_SECTORS ? '' : form.sectorId} onChange={(event) => setForm({ ...form, sectorId: event.target.value, userIds: [] })} required>
        <option value="">Selecione</option>
        {ownSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
      </select></label>}
      {!allSectors && ownSectors.length <= 1 && <label>Setor<input value={ownSectors[0]?.nome || 'Usuário sem setor definido'} disabled /></label>}
      {examSectorId
        ? <div className="exam-mode" role="radiogroup" aria-label="Para quem é a prova">
          <label className="quiz-option"><input type="radio" name="audience" checked={form.audience === 'setor'} onChange={() => setForm({ ...form, audience: 'setor' })} /><span><strong>Setor todo</strong><br />Todos os colaboradores do setor recebem a prova.</span></label>
          <label className="quiz-option"><input type="radio" name="audience" checked={form.audience === 'colaboradores'} onChange={() => setForm({ ...form, audience: 'colaboradores' })} /><span><strong>Colaboradores específicos</strong><br />Só as pessoas escolhidas recebem a prova (ex.: quem acabou de entrar).</span></label>
        </div>
        : <p className="hint">{allSectors && form.sectorId === ALL_SECTORS
          ? 'A prova fica disponível para os colaboradores de todos os setores. Para escolher colaboradores, escolha um setor.'
          : 'A prova fica disponível apenas para os colaboradores deste setor.'}</p>}
      {forSomeone && <fieldset><legend>Colaboradores do setor ({form.userIds.length} escolhido(s))</legend>
        {collaborators.length > 6 && <SearchField value={collaboratorFilter} onChange={setCollaboratorFilter} placeholder="Pesquisar colaborador pelo nome" label="Pesquisar colaborador" id="collaborator-search" />}
        {!collaborators.length && <p className="hint">Nenhum colaborador cadastrado neste setor.</p>}
        <div className="sector-picker">{visibleCollaborators.map((item) => <label key={item.id}>
          <input type="checkbox" checked={form.userIds.includes(item.id)} onChange={() => toggleCollaborator(item.id)} />{item.nome}
        </label>)}</div>
      </fieldset>}
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
