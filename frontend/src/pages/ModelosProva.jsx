/**
 * Modelos de prova: perguntas guardadas para reaplicar (ex.: colaborador novo entrou no setor).
 * Cada modelo pertence a um setor; gerente vê e aplica só os dos seus setores, admin e editor veem todos.
 * Aplicar cria uma prova nova (cópia das perguntas) para colaboradores escolhidos ou para o setor inteiro,
 * em todas as unidades ou em uma unidade. Gerente vê só colaboradores das suas unidades.
 * Regras no backend: controllers/examTemplateController.js.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { can, PERMISSIONS } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { matchesSearch } from '../utils/search.js';
import BackButton from '../components/BackButton.jsx';
import SearchField from '../components/SearchField.jsx';
import ExamQuestionsEditor, { newQuestion, serializeQuestions, templateQuestionsToEditor } from '../components/ExamQuestionsEditor.jsx';

const EMPTY_FORM = { id: null, sectorId: '', titulo: '', descricao: '', questions: [newQuestion()] };

/** Data no formato do datetime-local, no horário do computador. */
function toLocalInput(date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export default function ModelosProva() {
  const { apiUrl, token, user } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(null);
  const [applying, setApplying] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const allSectors = can(user, PERMISSIONS.ALL_SECTORS);
  // Só o perfil admin aplica para todos os setores (o backend também confere).
  const isAdmin = can(user, PERMISSIONS.APPLY_EXAM_ALL_SECTORS);
  const sectorOptions = allSectors ? sectors : user.setores || [];
  // Unidade da prova aplicada ao setor: gerente escolhe entre as suas; admin e editor, entre todas.
  const unitOptions = can(user, PERMISSIONS.ALL_UNITS) ? units : user.unidades || [];
  const headers = useMemo(() => createAuthHeaders(token), [token]);

  const load = useCallback(() => fetch(`${apiUrl}/api/exam-templates`, { headers })
    .then(readResponse).then(setTemplates).catch((error) => toast.error(error.message)), [apiUrl, headers, toast]);

  useEffect(() => {
    load();
    if (allSectors) fetch(`${apiUrl}/api/sectors`, { headers }).then(readResponse).then(setSectors).catch(() => {});
    fetch(`${apiUrl}/api/units`, { headers }).then(readResponse).then(setUnits).catch(() => {});
  }, [apiUrl, headers, allSectors, load]);

  const filtered = useMemo(() => (templates || []).filter((item) => matchesSearch(item.titulo, searchTerm)), [templates, searchTerm]);

  function startNew() {
    setApplying(null);
    setForm({ ...EMPTY_FORM, sectorId: sectorOptions.length === 1 ? String(sectorOptions[0].id) : '' });
  }

  async function startEdit(template) {
    setApplying(null);
    try {
      const full = await readResponse(await fetch(`${apiUrl}/api/exam-templates/${template.id}`, { headers }));
      setForm({ id: full.id, sectorId: String(full.sector_id), sectorName: full.sector_name, titulo: full.titulo, descricao: full.descricao || '', questions: templateQuestionsToEditor(full.questions) });
    } catch (error) { toast.error(error.message); }
  }

  async function saveTemplate(event) {
    event.preventDefault();
    if (!form.id && !form.sectorId) { toast.error('Escolha o setor do modelo.'); return; }
    setBusy(true);
    try {
      const body = JSON.stringify({ sectorId: form.sectorId, titulo: form.titulo, descricao: form.descricao, questions: serializeQuestions(form.questions) });
      const url = form.id ? `${apiUrl}/api/exam-templates/${form.id}` : `${apiUrl}/api/exam-templates`;
      await readResponse(await fetch(url, { method: form.id ? 'PUT' : 'POST', headers, body }));
      toast.success(form.id ? 'Modelo atualizado. Provas já aplicadas não mudam.' : 'Modelo criado.');
      setForm(null);
      load();
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  }

  async function removeTemplate(template) {
    if (!window.confirm(`Excluir o modelo "${template.titulo}"?\n\nAs provas já aplicadas e os resultados continuam no sistema.`)) return;
    try {
      await readResponse(await fetch(`${apiUrl}/api/exam-templates/${template.id}`, { method: 'DELETE', headers }));
      toast.success('Modelo excluído.');
      load();
    } catch (error) { toast.error(error.message); }
  }

  async function startApply(template) {
    setForm(null);
    try {
      const collaborators = await readResponse(await fetch(`${apiUrl}/api/exam-templates/${template.id}/collaborators`, { headers }));
      setApplying({ template, collaborators, audience: 'colaboradores', userIds: [], unitId: '', filter: '', startsAt: toLocalInput(new Date()), endsAt: toLocalInput(Date.now() + 7 * 24 * 3600 * 1000) });
    } catch (error) { toast.error(error.message); }
  }

  function toggleCollaborator(id) {
    setApplying((current) => ({ ...current, userIds: current.userIds.includes(id) ? current.userIds.filter((item) => item !== id) : [...current.userIds, id] }));
  }

  async function applyTemplate(event) {
    event.preventDefault();
    if (applying.audience === 'colaboradores' && !applying.userIds.length) { toast.error('Escolha pelo menos um colaborador.'); return; }
    setBusy(true);
    try {
      // datetime-local não tem fuso; a conversão usa o horário do computador de quem aplica.
      const body = JSON.stringify({
        audience: applying.audience,
        userIds: applying.userIds,
        unitId: applying.audience === 'colaboradores' ? null : Number(applying.unitId) || null,
        startsAt: new Date(applying.startsAt).toISOString(),
        endsAt: new Date(applying.endsAt).toISOString()
      });
      await readResponse(await fetch(`${apiUrl}/api/exam-templates/${applying.template.id}/apply`, { method: 'POST', headers, body }));
      const unitName = applying.audience !== 'colaboradores' && unitOptions.find((unit) => String(unit.id) === String(applying.unitId))?.nome;
      const who = (applying.audience === 'todos' ? 'todos os setores'
        : applying.audience === 'setor' ? `todo o setor ${applying.template.sector_name}` : `${applying.userIds.length} colaborador(es)`)
        + (unitName ? ` da unidade ${unitName}` : '');
      toast.success(`Prova aplicada para ${who}. Eles serão avisados no período de realização.`);
      setApplying(null);
      load();
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  }

  const visibleCollaborators = applying ? applying.collaborators.filter((item) => matchesSearch(item.nome, applying.filter)) : [];

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Modelos de Prova</h1>
      <p>Guarde as perguntas uma vez e aplique a prova sempre que precisar, para colaboradores específicos ou para o setor todo.</p></div>

    {!form && <button type="button" className="primary-button" onClick={startNew}><Plus size={18} /> Novo modelo</button>}

    {form && <form className="admin-panel manual-form" onSubmit={saveTemplate}>
      <h2>{form.id ? 'Editar modelo' : 'Novo modelo'}</h2>
      {form.id
        ? <label>Setor<input value={form.sectorName} disabled /></label>
        : sectorOptions.length === 1
          ? <label>Setor<input value={sectorOptions[0].nome} disabled /></label>
          : <label>Setor<select value={form.sectorId} onChange={(event) => setForm({ ...form, sectorId: event.target.value })} required>
            <option value="">Selecione</option>
            {sectorOptions.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
          </select></label>}
      <p className="hint">Só quem é deste setor vê e aplica o modelo.</p>
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição (opcional)<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <ExamQuestionsEditor questions={form.questions} onChange={(questions) => setForm({ ...form, questions })} />
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={() => setForm(null)}><X size={16} /> Cancelar</button>
        <button className="primary-button" disabled={busy}><Save size={18} /> Salvar modelo</button>
      </div>
    </form>}

    {applying && <form className="admin-panel manual-form" onSubmit={applyTemplate}>
      <h2>Aplicar "{applying.template.titulo}"</h2>
      <div className="exam-mode" role="radiogroup" aria-label="Para quem aplicar">
        <label className="quiz-option"><input type="radio" name="audience" checked={applying.audience === 'colaboradores'} onChange={() => setApplying({ ...applying, audience: 'colaboradores' })} /><span><strong>Colaboradores específicos</strong><br />Só as pessoas escolhidas recebem a prova (ex.: quem acabou de entrar).</span></label>
        <label className="quiz-option"><input type="radio" name="audience" checked={applying.audience === 'setor'} onChange={() => setApplying({ ...applying, audience: 'setor' })} /><span><strong>Todo o setor {applying.template.sector_name}</strong><br />Todos os colaboradores do setor recebem a prova.</span></label>
        {isAdmin && <label className="quiz-option"><input type="radio" name="audience" checked={applying.audience === 'todos'} onChange={() => setApplying({ ...applying, audience: 'todos' })} /><span><strong>Todos os setores</strong><br />Todos os colaboradores da empresa recebem a prova.</span></label>}
      </div>
      {applying.audience !== 'colaboradores' && units.length > 1 && <label>Unidade<select value={applying.unitId} onChange={(event) => setApplying({ ...applying, unitId: event.target.value })}>
        <option value="">Todas as unidades</option>
        {unitOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}
      </select></label>}
      {applying.audience === 'colaboradores' && <fieldset><legend>Colaboradores do setor {applying.template.sector_name} ({applying.userIds.length} escolhido(s))</legend>
        {applying.collaborators.length > 6 && <SearchField value={applying.filter} onChange={(filter) => setApplying({ ...applying, filter })} placeholder="Pesquisar colaborador pelo nome" label="Pesquisar colaborador" id="collaborator-search" />}
        {!applying.collaborators.length && <p className="hint">Nenhum colaborador cadastrado neste setor.</p>}
        <div className="sector-picker">{visibleCollaborators.map((item) => <label key={item.id}>
          <input type="checkbox" checked={applying.userIds.includes(item.id)} onChange={() => toggleCollaborator(item.id)} />{item.nome}{units.length > 1 && item.unit_names?.length ? ` (${item.unit_names.join(', ')})` : ''}
        </label>)}</div>
      </fieldset>}
      <div className="exam-period">
        <label>Início<input type="datetime-local" value={applying.startsAt} onChange={(event) => setApplying({ ...applying, startsAt: event.target.value })} required /></label>
        <label>Final<input type="datetime-local" value={applying.endsAt} min={applying.startsAt || undefined} onChange={(event) => setApplying({ ...applying, endsAt: event.target.value })} required /></label>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={() => setApplying(null)}><X size={16} /> Cancelar</button>
        <button className="primary-button" disabled={busy}><Send size={18} /> Aplicar prova</button>
      </div>
    </form>}

    {templates && templates.length > 6 && <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Pesquisar modelo pelo título" label="Pesquisar modelos" id="template-search" />}
    {templates && !templates.length && <p className="empty-state">Nenhum modelo cadastrado ainda.</p>}
    <div className="manual-grid">
      {filtered.map((template) => <div key={template.id} className="manual-card template-card">
        <div className="manual-logo"><ClipboardList size={28} /></div>
        <div>
          <h2>{template.titulo}</h2>
          <p>{template.descricao || `${template.question_count} pergunta(s)`}</p>
          <small>{template.sector_name} · {template.question_count} pergunta(s) · aplicado {template.applied_count} vez(es)</small>
          <div className="template-actions">
            <button type="button" className="primary-button" onClick={() => startApply(template)}><Send size={15} /> Aplicar</button>
            <button type="button" className="secondary-button" onClick={() => startEdit(template)}><Pencil size={15} /> Editar</button>
            <button type="button" className="secondary-button" onClick={() => removeTemplate(template)}><Trash2 size={15} /> Excluir</button>
          </div>
        </div>
      </div>)}
    </div>
  </section>;
}
