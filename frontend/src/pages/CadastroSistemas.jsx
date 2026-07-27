import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';

const INITIAL_FORM = { nome: '', resumo: '' };

/** Mantém os sistemas, que são visíveis para todos os setores. */
export default function CadastroSistemas() {
  const { apiUrl, token } = useAuth();
  const [systems, setSystems] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState('');

  async function loadSystems() {
    const response = await fetch(`${apiUrl}/api/systems`, { headers: createAuthHeaders(token) });
    setSystems(await readResponse(response));
  }

  useEffect(() => { loadSystems().catch((error) => setMessage(error.message)); }, [apiUrl, token]);

  // Cria um sistema global, sem qualquer vínculo com setor.
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/systems`, {
        method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify(form)
      });
      await readResponse(response);
      setForm(INITIAL_FORM);
      setMessage('Sistema cadastrado com sucesso.');
      await loadSystems();
    } catch (error) { setMessage(error.message); }
  }

  // Exclui o sistema após confirmação explícita do suporte.
  async function handleDelete(systemId) {
    if (!window.confirm('Remover este sistema?')) return;
    try {
      const response = await fetch(`${apiUrl}/api/systems/${systemId}`, {
        method: 'DELETE', headers: createAuthHeaders(token)
      });
      await readResponse(response);
      await loadSystems();
    } catch (error) { setMessage(error.message); }
  }

  return <section className="admin-page">
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Cadastrar Sistemas</h1></div>
    {message && <p className="notice">{message}</p>}
    <div className="admin-grid">
      <form className="admin-panel" onSubmit={handleSubmit}>
        <h2>Novo sistema</h2>
        <label>Nome<input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} required /></label>
        <label>Resumo<textarea value={form.resumo} onChange={(event) => setForm({ ...form, resumo: event.target.value })} /></label>
        <button className="primary-button"><Plus size={18} />Cadastrar sistema</button>
      </form>
      <div className="admin-panel"><h2>Sistemas disponíveis para todos os setores</h2><div className="table-list">
        {systems.map((system) => <div className="table-row" key={system.id}><span>{system.nome}</span><button type="button" onClick={() => handleDelete(system.id)} aria-label={`Remover ${system.nome}`}><Trash2 size={16} /></button></div>)}
      </div></div>
    </div>
  </section>;
}
