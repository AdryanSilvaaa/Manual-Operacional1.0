/**
 * Formulário de upload e vínculo do manual com sistema, um ou mais setores e as unidades (todas ou algumas).
 * Alterar nomes dos campos exige sincronizar middleware/upload.js e manualController.js.
 * Opcionalmente cadastra a prova do manual (campo exam, em JSON), liberada quando o colaborador conclui 100% do conteúdo:
 * obrigatória (ele faz na hora) ou não obrigatória (ele pode deixar para depois).
 */
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { can, PERMISSIONS } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';
import SectorPicker from '../components/SectorPicker.jsx';
import UnitScopePicker, { ALL_UNITS_SCOPE } from '../components/UnitScopePicker.jsx';
import { MAX_PDF_MB, MAX_VIDEO_MB, MAX_VIDEO_MINUTES, validateManualFile } from '../constants/uploads.js';
import { buildManualRequest, getUploadConfig } from '../utils/directUpload.js';
import ExamQuestionsEditor, { newQuestion, serializeQuestions } from '../components/ExamQuestionsEditor.jsx';
import TemplatePicker from '../components/TemplatePicker.jsx';

const INITIAL_FORM = { systemId: '', titulo: '', descricao: '', sectorIds: [], ...ALL_UNITS_SCOPE, pdf: null, video: null };
const INITIAL_EXAM = { enabled: false, required: true, titulo: '', descricao: '', templateId: null };

/** Prova do manual no formato do backend; sem título próprio, usa "Prova - <título do manual>". Não tem prazo: fica disponível até o colaborador fazer. */
function buildExamPayload(exam, questions, manualTitle) {
  return JSON.stringify({
    titulo: exam.titulo.trim() || `Prova - ${manualTitle.trim()}`,
    descricao: exam.descricao,
    required: exam.required,
    templateId: exam.templateId,
    questions: serializeQuestions(questions)
  });
}

/** Envia o material e o associa ao sistema e aos setores autorizados. */
export default function CriarManual() {
  const { apiUrl, token, user } = useAuth();
  const [systems, setSystems] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [exam, setExam] = useState(INITIAL_EXAM);
  const [questions, setQuestions] = useState([newQuestion()]);
  const toast = useToast();
  const [directUpload, setDirectUpload] = useState(false);
  const [sending, setSending] = useState('');
  // Trocar a chave recria o formulário e limpa os campos de arquivo depois de um cadastro.
  const [formKey, setFormKey] = useState(0);
  const isSectorManager = !can(user, PERMISSIONS.ALL_SECTORS);
  // O manual pode valer para vários setores: gerente escolhe entre os seus; admin e editor, entre todos.
  const sectorOptions = isSectorManager ? user?.setores || [] : sectors;
  const fixedSector = isSectorManager && sectorOptions.length <= 1;
  // Unidades: gerente escolhe entre as suas (ou todas as unidades); admin e editor, entre todas as cadastradas.
  const unitOptions = can(user, PERMISSIONS.ALL_UNITS) ? units : user?.unidades || [];

  useEffect(() => {
    async function loadOptions() {
      const headers = createAuthHeaders(token);
      const [systemsResponse, sectorsResponse, unitsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/systems`, { headers }), fetch(`${apiUrl}/api/sectors`, { headers }), fetch(`${apiUrl}/api/units`, { headers })
      ]);
      setSystems(await readResponse(systemsResponse));
      setSectors(await readResponse(sectorsResponse));
      setUnits(await readResponse(unitsResponse));
      setDirectUpload(Boolean((await getUploadConfig(apiUrl, token)).directUpload));
    }
    loadOptions().catch((error) => toast.error(error.message));
  }, [apiUrl, token, toast]);

  // Confere tamanho e duração ao escolher o arquivo; fora do limite, o campo é limpo e o motivo aparece em um pop-up.
  async function chooseFile(kind, input) {
    const file = input.files[0] || null;
    const problem = await validateManualFile(kind, file);
    if (problem) {
      input.value = '';
      setForm((current) => ({ ...current, [kind]: null }));
      toast.error(problem);
      return;
    }
    setForm((current) => ({ ...current, [kind]: file }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!fixedSector && !form.sectorIds.length) {
      toast.error('Selecione pelo menos um setor.');
      return;
    }
    if (form.unitScope === 'selecionadas' && !form.unitIds.length) {
      toast.error('Selecione pelo menos uma unidade ou marque Todas as unidades.');
      return;
    }
    if (!form.pdf && !form.video) {
      toast.error('Escolha pelo menos o PDF ou o vídeo do manual.');
      return;
    }
    setSending('Enviando...');
    try {
      const { pdf, video, ...formFields } = form;
      const fields = exam.enabled ? { ...formFields, exam: buildExamPayload(exam, questions, form.titulo) } : formFields;
      const { headers, body } = await buildManualRequest({ apiUrl, token, directUpload, fields, pdf, video, onStatus: setSending });
      const response = await fetch(`${apiUrl}/api/manuals`, { method: 'POST', headers, body });
      await readResponse(response);
      setForm(INITIAL_FORM);
      setExam(INITIAL_EXAM);
      setQuestions([newQuestion()]);
      setFormKey((current) => current + 1);
      toast.success(exam.enabled ? 'Manual e prova cadastrados com sucesso.' : 'Manual cadastrado com sucesso.');
    } catch (error) { toast.error(error.message); } finally { setSending(''); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar Manual</h1></div>
    <form key={formKey} className="admin-panel manual-form" onSubmit={handleSubmit}>
      <label>Sistema<select value={form.systemId} onChange={(event) => setForm({ ...form, systemId: event.target.value })} required><option value="">Selecione</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.nome}</option>)}</select></label>
      {fixedSector ? <label>Setor<input value={sectorOptions[0]?.nome || 'Usuário sem setor definido'} disabled /></label> : <fieldset>
        <legend>Setores</legend>
        <SectorPicker sectors={sectorOptions} value={form.sectorIds} onChange={(value) => setForm({ ...form, sectorIds: value })} allLabel={isSectorManager ? 'Todos os meus setores' : 'Todos os setores'} />
        <span className="hint">O manual aparece para quem for de qualquer um dos setores marcados.</span>
      </fieldset>}
      <UnitScopePicker units={unitOptions} totalUnits={units.length} value={form} onChange={(scope) => setForm({ ...form, ...scope })} />
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <label>PDF<input type="file" accept="application/pdf" onChange={(event) => chooseFile('pdf', event.target)} /><span className="hint">Até {MAX_PDF_MB} MB.</span></label>
      <label>Vídeo<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => chooseFile('video', event.target)} /><span className="hint">Até {MAX_VIDEO_MINUTES} minutos e {MAX_VIDEO_MB} MB. Prefira MP4 (H.264) em 1080p ou 720p.</span></label>
      <p className="hint">Envie o PDF, o vídeo ou os dois. Pelo menos um deles é obrigatório.</p>
      <fieldset className="manual-exam-options">
        <legend>Prova do manual</legend>
        <label className="checkbox-line"><input type="checkbox" checked={exam.enabled} onChange={(event) => setExam({ ...exam, enabled: event.target.checked })} />Cadastrar prova deste manual</label>
        {exam.enabled && <>
          <div className="exam-mode" role="radiogroup" aria-label="Tipo da prova">
            <label className="quiz-option"><input type="radio" name="exam-required" checked={exam.required} onChange={() => setExam({ ...exam, required: true })} /><span><strong>Prova obrigatória</strong><br />Ao concluir 100% do conteúdo, o colaborador precisa fazer a prova na hora.</span></label>
            <label className="quiz-option"><input type="radio" name="exam-required" checked={!exam.required} onChange={() => setExam({ ...exam, required: false })} /><span><strong>Prova não obrigatória</strong><br />Ao concluir 100% do conteúdo, a prova é exibida, mas ele pode fazer depois pelo menu Provas. A prova não expira.</span></label>
          </div>
          <label>Título da prova (opcional)<input value={exam.titulo} placeholder={form.titulo ? `Prova - ${form.titulo}` : 'Prova - título do manual'} onChange={(event) => setExam({ ...exam, titulo: event.target.value })} /></label>
          <label>Orientações (opcional)<textarea value={exam.descricao} onChange={(event) => setExam({ ...exam, descricao: event.target.value })} /></label>
          <TemplatePicker value={exam.templateId} onPick={(template) => {
            if (!template) { setExam({ ...exam, templateId: null }); return; }
            setExam({ ...exam, templateId: template.id, titulo: template.titulo, descricao: template.descricao || '' });
            setQuestions(template.editorQuestions);
          }} />
          <ExamQuestionsEditor questions={questions} onChange={setQuestions} />
        </>}
      </fieldset>
      <button className="primary-button" disabled={Boolean(sending)}>{sending || <><Plus size={18} />Cadastrar manual</>}</button>
    </form>
  </section>;
}
