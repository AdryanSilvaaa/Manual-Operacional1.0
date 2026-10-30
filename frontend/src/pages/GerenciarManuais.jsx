/**
 * Edição, ativação e exclusão dos manuais já publicados (inclusive os inativos).
 * Quem pode alterar cada manual é decidido no backend (utils/access.js, canManageManual):
 * suporte e editor de conteúdo alteram todos; gerente de setor só os manuais que são apenas dos seus setores.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Save, Trash2, Undo2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { matchesSearch } from '../utils/search.js';
import BackButton from '../components/BackButton.jsx';
import SearchField from '../components/SearchField.jsx';
import SectorPicker from '../components/SectorPicker.jsx';
import { MAX_PDF_MB, MAX_VIDEO_MB, MAX_VIDEO_MINUTES, validateManualFile } from '../constants/uploads.js';
import { buildManualRequest, getUploadConfig } from '../utils/directUpload.js';

const filesOf = (manual) => [manual.has_pdf && 'PDF', manual.has_video && 'Vídeo'].filter(Boolean).join(' e ') || '—';

// Textos e tipos aceitos de cada arquivo do manual no formulário de edição.
const FILE_KINDS = {
  pdf: { name: 'PDF', accept: 'application/pdf', has: 'hasPdf', remove: 'removePdf', other: 'video' },
  video: { name: 'vídeo', accept: 'video/mp4,video/webm,video/quicktime', has: 'hasVideo', remove: 'removeVideo', other: 'pdf' }
};

export default function GerenciarManuais() {
  const { apiUrl, token, user } = useAuth();
  const [manuals, setManuals] = useState([]);
  const [systems, setSystems] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [directUpload, setDirectUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  // Manual em edição (cópia dos campos do formulário); null quando nenhum está aberto.
  const [editing, setEditing] = useState(null);
  const [sending, setSending] = useState('');
  const formRef = useRef(null);
  const isSectorManager = user?.role === ROLES.SECTOR_MANAGER;
  const sectorOptions = isSectorManager ? user?.setores || [] : sectors;
  const fixedSector = isSectorManager && sectorOptions.length <= 1;

  async function loadManuals() {
    const response = await fetch(`${apiUrl}/api/manuals/manage`, { headers: createAuthHeaders(token) });
    setManuals(await readResponse(response));
  }

  useEffect(() => {
    async function loadAll() {
      const headers = createAuthHeaders(token);
      const [systemsResponse, sectorsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/systems`, { headers }), fetch(`${apiUrl}/api/sectors`, { headers })
      ]);
      setSystems(await readResponse(systemsResponse));
      setSectors(await readResponse(sectorsResponse));
      setDirectUpload(Boolean((await getUploadConfig(apiUrl, token)).directUpload));
      await loadManuals();
    }
    loadAll().catch((error) => setMessage(error.message));
  }, [apiUrl, token]);

  const filtered = useMemo(
    () => manuals.filter((manual) => matchesSearch(`${manual.titulo} ${manual.system_name || ''} ${(manual.sector_names || []).join(' ')}`, searchTerm)),
    [manuals, searchTerm]
  );

  useEffect(() => { if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [editing?.id]);

  function startEdit(manual) {
    setMessage('');
    setEditing({
      id: manual.id, titulo: manual.titulo, descricao: manual.descricao || '', systemId: String(manual.system_id || ''),
      sectorIds: manual.sector_ids || [], hasPdf: manual.has_pdf, hasVideo: manual.has_video, pdf: null, video: null,
      removePdf: false, removeVideo: false
    });
  }

  // O arquivo continua no manual se já existe e não foi marcado para remoção, ou se um novo foi escolhido.
  const keepsFile = (kind) => Boolean(editing[kind] || (editing[FILE_KINDS[kind].has] && !editing[FILE_KINDS[kind].remove]));

  // Marca ou desmarca a remoção; marcar descarta um arquivo novo escolhido para o mesmo campo.
  function toggleRemove(kind) {
    setMessage('');
    setEditing((current) => ({ ...current, [FILE_KINDS[kind].remove]: !current[FILE_KINDS[kind].remove], [kind]: null }));
  }

  function renderFileField(kind) {
    const { name, accept, has, remove, other } = FILE_KINDS[kind];
    const removing = editing[remove];
    const isLastFile = !keepsFile(other);
    const limit = kind === 'pdf' ? `Até ${MAX_PDF_MB} MB.` : `Até ${MAX_VIDEO_MINUTES} minutos e ${MAX_VIDEO_MB} MB.`;
    return <div className="file-field">
      {editing[has] && <div className={`current-file${removing ? ' removing' : ''}`}>
        <span>{removing ? `${name[0].toUpperCase()}${name.slice(1)} atual será removido ao salvar.` : `Este manual tem ${name}.`}</span>
        {removing
          ? <button type="button" className="secondary-button" onClick={() => toggleRemove(kind)}><Undo2 size={16} />Desfazer</button>
          : <button type="button" className="secondary-button" onClick={() => toggleRemove(kind)} disabled={isLastFile}
              title={isLastFile ? 'O manual precisa ficar com pelo menos o PDF ou o vídeo' : undefined}><Trash2 size={16} />Remover {name}</button>}
      </div>}
      {!removing && <label>{editing[has] ? `Trocar ${name}` : `Adicionar ${name}`}<input type="file" accept={accept} onChange={(event) => chooseFile(kind, event.target)} /><span className="hint">{limit}</span></label>}
    </div>;
  }

  // Mesma conferência de tamanho e duração do cadastro; fora do limite, o campo é limpo.
  async function chooseFile(kind, input) {
    const file = input.files[0] || null;
    const problem = await validateManualFile(kind, file);
    if (problem) input.value = '';
    setMessage(problem || '');
    setEditing((current) => ({ ...current, [kind]: problem ? null : file }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!editing.sectorIds.length) {
      setMessage('Selecione pelo menos um setor.');
      return;
    }
    const removed = [editing.removePdf && 'o PDF', editing.removeVideo && 'o vídeo'].filter(Boolean).join(' e ');
    if (removed && !window.confirm(`Remover ${removed} do manual "${editing.titulo}"?\n\nO arquivo é apagado do armazenamento e isso não pode ser desfeito. O progresso dos colaboradores na parte que fica é mantido.`)) return;
    setMessage('');
    setSending('Salvando...');
    try {
      const { id, titulo, descricao, systemId, sectorIds, pdf, video, removePdf, removeVideo } = editing;
      // Campos de remoção só vão quando marcados.
      const removal = { removePdf: removePdf || undefined, removeVideo: removeVideo || undefined };
      const { headers, body } = await buildManualRequest({
        apiUrl, token, directUpload, fields: { titulo, descricao, systemId, sectorIds, ...removal }, pdf, video, onStatus: setSending
      });
      await readResponse(await fetch(`${apiUrl}/api/manuals/${id}`, { method: 'PUT', headers, body }));
      setEditing(null);
      setMessage('Manual atualizado com sucesso.');
      await loadManuals();
    } catch (error) { setMessage(error.message); } finally { setSending(''); }
  }

  // Desativar tira o manual da lista dos colaboradores sem apagar o progresso; ativar devolve.
  async function toggleActive(manual) {
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/manuals/${manual.id}`, {
        method: 'PUT', headers: createAuthHeaders(token), body: JSON.stringify({ active: !manual.active })
      });
      await readResponse(response);
      setMessage(manual.active ? `"${manual.titulo}" desativado. O progresso dos colaboradores continua guardado.` : `"${manual.titulo}" ativado.`);
      await loadManuals();
    } catch (error) { setMessage(error.message); }
  }

  async function handleDelete(manual) {
    const confirmed = window.confirm(`Excluir o manual "${manual.titulo}"?\n\nO progresso e o histórico de leitura dos colaboradores também serão apagados, e isso não pode ser desfeito. Para só tirar o manual do ar, use Desativar.`);
    if (!confirmed) return;
    setMessage('');
    try {
      await readResponse(await fetch(`${apiUrl}/api/manuals/${manual.id}`, { method: 'DELETE', headers: createAuthHeaders(token) }));
      if (editing?.id === manual.id) setEditing(null);
      setMessage(`"${manual.titulo}" excluído.`);
      await loadManuals();
    } catch (error) { setMessage(error.message); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Gerenciar Manuais</h1></div>
    {message && <p className="notice">{message}</p>}

    {editing && <form key={editing.id} ref={formRef} className="admin-panel manual-form" onSubmit={handleSave}>
      <h2>Editar manual</h2>
      <label>Sistema<select value={editing.systemId} onChange={(event) => setEditing({ ...editing, systemId: event.target.value })} required><option value="">Selecione</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.nome}</option>)}</select></label>
      {fixedSector ? <label>Setor<input value={sectorOptions[0]?.nome || 'Usuário sem setor definido'} disabled /></label> : <fieldset>
        <legend>Setores</legend>
        <SectorPicker sectors={sectorOptions} value={editing.sectorIds} onChange={(value) => setEditing({ ...editing, sectorIds: value })} allLabel={isSectorManager ? 'Todos os meus setores' : 'Todos os setores'} />
        <span className="hint">O manual aparece para quem for de qualquer um dos setores marcados.</span>
      </fieldset>}
      <label>Título<input value={editing.titulo} onChange={(event) => setEditing({ ...editing, titulo: event.target.value })} required /></label>
      <label>Descrição<textarea value={editing.descricao} onChange={(event) => setEditing({ ...editing, descricao: event.target.value })} /></label>
      {renderFileField('pdf')}
      {renderFileField('video')}
      <p className="hint">Deixe os arquivos em branco para manter os atuais. Enviar um arquivo novo cria uma nova versão e zera o progresso dos colaboradores neste manual (o anterior fica guardado no histórico). Remover um arquivo mantém o progresso na parte que fica.</p>
      <div className="form-actions">
        <button className="primary-button" disabled={Boolean(sending)}>{sending || <><Save size={18} />Salvar alterações</>}</button>
        <button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={Boolean(sending)}><X size={16} />Cancelar</button>
      </div>
    </form>}

    <div className="dashboard-panel admin-panel">
      <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Pesquisar por título, sistema ou setor" label="Pesquisar manuais" id="manage-manuals-search" />
      {isSectorManager && <p className="hint">Aparecem aqui os manuais que são apenas dos seus setores. Manuais compartilhados com outros setores são alterados pelo suporte ou pelo editor de conteúdo.</p>}
      {filtered.length ? <div className="report-table-wrap"><table className="report-table manage-table"><thead><tr><th>Título</th><th>Sistema</th><th>Setores</th><th>Arquivos</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
        {filtered.map((manual) => <tr key={manual.id}>
          <td className="wrap"><strong>{manual.titulo}</strong>{manual.version > 1 && <span className="hint"> · versão {manual.version}</span>}</td>
          <td>{manual.system_name || '—'}</td>
          <td className="wrap">{(manual.sector_names || []).join(', ')}</td>
          <td>{filesOf(manual)}</td>
          <td><span className={`status-pill ${manual.active ? 'status-concluido' : 'status-nao-iniciado'}`}>{manual.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><div className="row-actions">
            <button type="button" onClick={() => startEdit(manual)} aria-label={`Editar ${manual.titulo}`} title="Editar"><Pencil size={16} /></button>
            <button type="button" onClick={() => toggleActive(manual)} aria-label={`${manual.active ? 'Desativar' : 'Ativar'} ${manual.titulo}`} title={manual.active ? 'Desativar' : 'Ativar'}>{manual.active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <button type="button" onClick={() => handleDelete(manual)} aria-label={`Excluir ${manual.titulo}`} title="Excluir"><Trash2 size={16} /></button>
          </div></td>
        </tr>)}
      </tbody></table></div> : <p className="empty-state">{searchTerm ? `Nenhum manual encontrado para “${searchTerm}”.` : 'Nenhum manual para gerenciar.'}</p>}
    </div>
  </section>;
}
