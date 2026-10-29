/**
 * Formulário de upload e vínculo do manual com sistema e um ou mais setores.
 * Alterar nomes dos campos exige sincronizar middleware/upload.js e manualController.js.
 */
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';
import SectorPicker from '../components/SectorPicker.jsx';
import { MAX_PDF_MB, MAX_VIDEO_MB, MAX_VIDEO_MINUTES, validateManualFile } from '../constants/uploads.js';
import { buildManualRequest, getUploadConfig } from '../utils/directUpload.js';

const INITIAL_FORM = { systemId: '', titulo: '', descricao: '', sectorIds: [], pdf: null, video: null };

/** Envia o material e o associa ao sistema e aos setores autorizados. */
export default function CriarManual() {
  const { apiUrl, token, user } = useAuth();
  const [systems, setSystems] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState('');
  const [directUpload, setDirectUpload] = useState(false);
  const [sending, setSending] = useState('');
  // Trocar a chave recria o formulário e limpa os campos de arquivo depois de um cadastro.
  const [formKey, setFormKey] = useState(0);
  const isSectorManager = user?.role === ROLES.SECTOR_MANAGER;
  // O manual pode valer para vários setores: gerente escolhe entre os seus; suporte e editor, entre todos.
  const sectorOptions = isSectorManager ? user?.setores || [] : sectors;
  const fixedSector = isSectorManager && sectorOptions.length <= 1;

  useEffect(() => {
    async function loadOptions() {
      const headers = createAuthHeaders(token);
      const [systemsResponse, sectorsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/systems`, { headers }), fetch(`${apiUrl}/api/sectors`, { headers })
      ]);
      setSystems(await readResponse(systemsResponse));
      setSectors(await readResponse(sectorsResponse));
      setDirectUpload(Boolean((await getUploadConfig(apiUrl, token)).directUpload));
    }
    loadOptions().catch((error) => setMessage(error.message));
  }, [apiUrl, token]);

  // Confere tamanho e duração ao escolher o arquivo; fora do limite, o campo é limpo e o motivo aparece no aviso.
  async function chooseFile(kind, input) {
    const file = input.files[0] || null;
    const problem = await validateManualFile(kind, file);
    if (problem) {
      input.value = '';
      setForm((current) => ({ ...current, [kind]: null }));
      setMessage(problem);
      return;
    }
    setMessage('');
    setForm((current) => ({ ...current, [kind]: file }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!fixedSector && !form.sectorIds.length) {
      setMessage('Selecione pelo menos um setor.');
      return;
    }
    if (!form.pdf && !form.video) {
      setMessage('Escolha pelo menos o PDF ou o vídeo do manual.');
      return;
    }
    setMessage('');
    setSending('Enviando...');
    try {
      const { pdf, video, ...fields } = form;
      const { headers, body } = await buildManualRequest({ apiUrl, token, directUpload, fields, pdf, video, onStatus: setSending });
      const response = await fetch(`${apiUrl}/api/manuals`, { method: 'POST', headers, body });
      await readResponse(response);
      setForm(INITIAL_FORM);
      setFormKey((current) => current + 1);
      setMessage('Manual cadastrado com sucesso.');
    } catch (error) { setMessage(error.message); } finally { setSending(''); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar Manual</h1></div>
    {message && <p className="notice">{message}</p>}
    <form key={formKey} className="admin-panel manual-form" onSubmit={handleSubmit}>
      <label>Sistema<select value={form.systemId} onChange={(event) => setForm({ ...form, systemId: event.target.value })} required><option value="">Selecione</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.nome}</option>)}</select></label>
      {fixedSector ? <label>Setor<input value={sectorOptions[0]?.nome || 'Usuário sem setor definido'} disabled /></label> : <fieldset>
        <legend>Setores</legend>
        <SectorPicker sectors={sectorOptions} value={form.sectorIds} onChange={(value) => setForm({ ...form, sectorIds: value })} allLabel={isSectorManager ? 'Todos os meus setores' : 'Todos os setores'} />
        <span className="hint">O manual aparece para quem for de qualquer um dos setores marcados.</span>
      </fieldset>}
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <label>PDF<input type="file" accept="application/pdf" onChange={(event) => chooseFile('pdf', event.target)} /><span className="hint">Até {MAX_PDF_MB} MB.</span></label>
      <label>Vídeo<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => chooseFile('video', event.target)} /><span className="hint">Até {MAX_VIDEO_MINUTES} minutos e {MAX_VIDEO_MB} MB. Prefira MP4 (H.264) em 1080p ou 720p.</span></label>
      <p className="hint">Envie o PDF, o vídeo ou os dois. Pelo menos um deles é obrigatório.</p>
      <button className="primary-button" disabled={Boolean(sending)}>{sending || <><Plus size={18} />Cadastrar manual</>}</button>
    </form>
  </section>;
}
