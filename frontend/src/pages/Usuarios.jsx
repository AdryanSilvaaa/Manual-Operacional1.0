/**
 * CRUD de usuários, perfis e setores acessível ao suporte.
 * Alterar perfis/campos exige sincronizar roles.js, backend e schema.sql.
 */
import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';

const INITIAL_FORM = { nome: '', identificador: '', senha: '', role: 'usuario', setor: '' };
const PROFILE_OPTIONS = [
  { value: 'usuario', label: 'Usuário comum' },
  { value: 'gerente_setor', label: 'Gerente de setor' },
  { value: 'suporte', label: 'Suporte' }
];

/** Gerencia usuários, credenciais e o setor que governa seu acesso aos manuais. */
export default function Usuarios() {
  const { apiUrl, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState('');

  async function loadData() {
    const headers = createAuthHeaders(token);
    const [usersResponse, sectorsResponse] = await Promise.all([
      fetch(`${apiUrl}/api/users`, { headers }), fetch(`${apiUrl}/api/sectors`, { headers })
    ]);
    setUsers(await readResponse(usersResponse));
    setSectors(await readResponse(sectorsResponse));
  }

  useEffect(() => { loadData().catch((error) => setMessage(error.message)); }, [apiUrl, token]);

  // Mantém o formulário de criação independente da edição em linha.
  function updateCreateForm(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function updateEditingUser(field, value) { setEditingUser((current) => ({ ...current, [field]: value })); }

  async function handleCreate(event) {
    event.preventDefault();
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify(form)
      });
      await readResponse(response);
      setForm(INITIAL_FORM);
      setMessage('Usuário cadastrado com sucesso.');
      await loadData();
    } catch (error) { setMessage(error.message); }
  }

  // Salva nome, perfil, identificador e setor do usuário selecionado.
  async function handleSave() {
    if (!editingUser) return;
    try {
      const response = await fetch(`${apiUrl}/api/users/${editingUser.id}`, {
        method: 'PUT', headers: createAuthHeaders(token), body: JSON.stringify(editingUser)
      });
      await readResponse(response);
      setEditingUser(null);
      setMessage('Usuário atualizado com sucesso.');
      await loadData();
    } catch (error) { setMessage(error.message); }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Remover o usuário ${user.nome}?`)) return;
    try {
      const response = await fetch(`${apiUrl}/api/users/${user.id}`, {
        method: 'DELETE', headers: createAuthHeaders(token)
      });
      await readResponse(response);
      await loadData();
    } catch (error) { setMessage(error.message); }
  }

  function SectorInput({ value, onChange }) {
    return <><input list="sectors" value={value || ''} onChange={(event) => onChange(event.target.value)} required /><datalist id="sectors">{sectors.map((sector) => <option key={sector.id} value={sector.nome} />)}</datalist></>;
  }

  function RoleSelect({ value, onChange }) {
    return <select value={value} onChange={(event) => onChange(event.target.value)}>{PROFILE_OPTIONS.map((profile) => <option key={profile.value} value={profile.value}>{profile.label}</option>)}</select>;
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar / Alterar Usuários</h1></div>
    {message && <p className="notice">{message}</p>}
    <div className="admin-grid">
      <form className="admin-panel" onSubmit={handleCreate}>
        <h2>Novo usuário</h2>
        <label>Nome<input value={form.nome} onChange={(event) => updateCreateForm('nome', event.target.value)} required /></label>
        <label>Usuário para login<input value={form.identificador} onChange={(event) => updateCreateForm('identificador', event.target.value)} required /></label>
        <label>Setor<SectorInput value={form.setor} onChange={(value) => updateCreateForm('setor', value)} /></label>
        <label>Senha<input type="password" value={form.senha} onChange={(event) => updateCreateForm('senha', event.target.value)} required /></label>
        <label>Perfil<RoleSelect value={form.role} onChange={(value) => updateCreateForm('role', value)} /></label>
        <button className="primary-button"><Plus size={18} />Cadastrar usuário</button>
      </form>
      <div className="admin-panel"><h2>Usuários cadastrados</h2><div className="table-list">
        {users.map((user) => <div className="table-row" key={user.id}>
          {editingUser?.id === user.id ? <div className="edit-stack">
            <input value={editingUser.nome} onChange={(event) => updateEditingUser('nome', event.target.value)} />
            <input value={editingUser.identificador || ''} onChange={(event) => updateEditingUser('identificador', event.target.value)} />
            <SectorInput value={editingUser.setor} onChange={(value) => updateEditingUser('setor', value)} />
            <RoleSelect value={editingUser.role} onChange={(value) => updateEditingUser('role', value)} />
          </div> : <span>{user.nome} · {PROFILE_OPTIONS.find((profile) => profile.value === user.role)?.label || user.role} · {user.setor || 'Sem setor'}</span>}
          <div className="row-actions">{editingUser?.id === user.id ? <><button type="button" onClick={handleSave} aria-label="Salvar usuário"><Save size={16} /></button><button type="button" onClick={() => setEditingUser(null)} aria-label="Cancelar edição"><X size={16} /></button></> : <><button type="button" onClick={() => setEditingUser({ ...user, setor: user.setor || '' })} aria-label="Editar usuário"><Pencil size={16} /></button><button type="button" onClick={() => handleDelete(user)} aria-label="Remover usuário"><Trash2 size={16} /></button></>}</div>
        </div>)}
      </div></div>
    </div>
  </section>;
}
