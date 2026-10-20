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
import { MAX_PDF_MB, MAX_VIDEO_MB, MAX_VIDEO_MINUTES, validateManualFile } from '../constants/uploads.js';
import { getUploadConfig, uploadToBucket } from '../utils/directUpload.js';

const INITIAL_FORM = { systemId: '', titulo: '', descricao: '', setor: '', pdf: null, video: null };

/** Gerente com um setor vê o setor fixo; com vários, escolhe em qual deles publicar. */
function ManagerSectorField({ sectors, value, onChange }) {
  if (sectors.length <= 1) return <label>Setor<input value={sectors[0]?.nome || 'Usuário sem setor definido'} disabled /></label>;
  return <label>Setor<select value={value} onChange={(event) => onChange(event.target.value)} required>
    <option value="">Selecione</option>
    {sectors.map((sector) => <option key={sector.id} value={sector.nome}>{sector.nome}</option>)}
  </select></label>;
}

/** Envia o material e o associa ao sistema e setor autorizados. */
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
  const ownSectors = user?.setores || [];

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

  // Com bucket (directUpload), os arquivos vão do navegador direto ao armazenamento e o cadastro leva só as chaves.
  // Sem bucket, monta o multipart sem forçar Content-Type para preservar o boundary do navegador.
  async function buildRequest() {
    const { pdf, video, ...fields } = form;
    if (!directUpload) {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      return { headers: createAuthHeaders(token, false), body: payload };
    }
    const pdfKey = await uploadToBucket({ apiUrl, token, kind: 'pdf', file: pdf, onProgress: (percent) => setSending(`Enviando PDF... ${percent}%`) });
    const videoKey = await uploadToBucket({ apiUrl, token, kind: 'video', file: video, onProgress: (percent) => setSending(`Enviando vídeo... ${percent}%`) });
    setSending('Salvando manual...');
    return { headers: createAuthHeaders(token), body: JSON.stringify({ ...fields, pdfKey, videoKey }) };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setSending('Enviando...');
    try {
      const { headers, body } = await buildRequest();
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
      {isSectorManager ? <ManagerSectorField sectors={ownSectors} value={form.setor} onChange={(value) => setForm({ ...form, setor: value })} /> : <label>Setor<input list="sectors" value={form.setor} onChange={(event) => setForm({ ...form, setor: event.target.value })} required /><datalist id="sectors">{sectors.map((sector) => <option key={sector.id} value={sector.nome} />)}</datalist></label>}
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <label>PDF<input type="file" accept="application/pdf" onChange={(event) => chooseFile('pdf', event.target)} required /><span className="hint">Até {MAX_PDF_MB} MB.</span></label>
      <label>Vídeo<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => chooseFile('video', event.target)} required /><span className="hint">Até {MAX_VIDEO_MINUTES} minutos e {MAX_VIDEO_MB} MB. Prefira MP4 (H.264) em 1080p ou 720p.</span></label>
      <button className="primary-button" disabled={Boolean(sending)}>{sending || <><Plus size={18} />Cadastrar manual</>}</button>
    </form>
  </section>;
}
