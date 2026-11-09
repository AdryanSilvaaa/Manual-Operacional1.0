/**
 * Modelos de prova: perguntas guardadas para reaplicar (ex.: colaborador novo entrou no setor).
 * Cada modelo pertence a um setor; gerente vê só os dos seus setores, suporte e editor veem todos.
 * Esta tela só guarda os modelos. "Aplicar" abre Criar Prova já preenchida (?modelo=ID), onde se escolhe
 * o período e para quem vai a prova (setor todo ou colaboradores específicos).
 * Regras no backend: controllers/examTemplateController.js.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ALL_SECTOR_ROLES } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { matchesSearch } from '../utils/search.js';
import BackButton from '../components/BackButton.jsx';
import SearchField from '../components/SearchField.jsx';
import ExamQuestionsEditor, { newQuestion, serializeQuestions, templateQuestionsToEditor } from '../components/ExamQuestionsEditor.jsx';

const EMPTY_FORM = { id: null, sectorId: '', titulo: '', descricao: '', questions: [newQuestion()] };

export default function ModelosProva() {
  const { apiUrl, token, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const allSectors = ALL_SECTOR_ROLES.includes(user.role);
  const sectorOptions = allSectors ? sectors : user.setores || [];
  const headers = useMemo(() => createAuthHeaders(token), [token]);

  const load = useCallback(() => fetch(`${apiUrl}/api/exam-templates`, { headers })
    .then(readResponse).then(setTemplates).catch((error) => toast.error(error.message)), [apiUrl, headers, toast]);

  useEffect(() => {
    load();
    if (allSectors) fetch(`${apiUrl}/api/sectors`, { headers }).then(readResponse).then(setSectors).catch(() => {});
  }, [apiUrl, headers, allSectors, load]);

  const filtered = useMemo(() => (templates || []).filter((item) => matchesSearch(item.titulo, searchTerm)), [templates, searchTerm]);

  function startNew() {
    setForm({ ...EMPTY_FORM, sectorId: sectorOptions.length === 1 ? String(sectorOptions[0].id) : '' });
  }

  async function startEdit(template) {
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

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Modelos de Prova</h1>
      <p>Guarde as perguntas uma vez e reutilize sempre que precisar. O botão Aplicar abre a tela Criar Prova já preenchida, para escolher o período e para quem vai a prova.</p></div>

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
            <button type="button" className="primary-button" onClick={() => navigate(`/configuracoes/provas?modelo=${template.id}`)}><Send size={15} /> Aplicar</button>
            <button type="button" className="secondary-button" onClick={() => startEdit(template)}><Pencil size={15} /> Editar</button>
            <button type="button" className="secondary-button" onClick={() => removeTemplate(template)}><Trash2 size={15} /> Excluir</button>
          </div>
        </div>
      </div>)}
    </div>
  </section>;
}
