import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';

const INITIAL_FORM = { systemId: '', titulo: '', descricao: '', setor: '', pdf: null, video: null };

/** Envia o material e o associa ao sistema e setor autorizados. */
export default function CriarManual() {
  const { apiUrl, token, user } = useAuth();
  const [systems, setSystems] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState('');
  const isSectorManager = user?.role === 'gerente_setor';

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

    try {
      const response = await fetch(`${apiUrl}/api/manuals`, {
        method: 'POST', headers: createAuthHeaders(token, false), body: payload
      });
      await readResponse(response);
      setForm(INITIAL_FORM);
      setMessage('Manual cadastrado com sucesso.');
    } catch (error) { setMessage(error.message); }
  }

  return <section className="admin-page">
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar Manual</h1></div>
    {message && <p className="notice">{message}</p>}
    <form className="admin-panel manual-form" onSubmit={handleSubmit}>
      <label>Sistema<select value={form.systemId} onChange={(event) => setForm({ ...form, systemId: event.target.value })} required><option value="">Selecione</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.nome}</option>)}</select></label>
      {isSectorManager ? <label>Setor<input value={user.setor || 'Seu setor'} disabled /></label> : <label>Setor<input list="sectors" value={form.setor} onChange={(event) => setForm({ ...form, setor: event.target.value })} required /><datalist id="sectors">{sectors.map((sector) => <option key={sector.id} value={sector.nome} />)}</datalist></label>}
      <label>Título<input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /></label>
      <label>Descrição<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></label>
      <label>PDF<input type="file" accept="application/pdf" onChange={(event) => setForm({ ...form, pdf: event.target.files[0] })} required /></label>
      <label>Vídeo<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => setForm({ ...form, video: event.target.files[0] })} required /></label>
      <button className="primary-button"><Plus size={18} />Cadastrar manual</button>
    </form>
  </section>;
}
