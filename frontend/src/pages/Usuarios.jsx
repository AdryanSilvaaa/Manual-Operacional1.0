/**
 * CRUD de usuários, perfis e setores acessível ao suporte.
 * Alterar perfis/campos exige sincronizar roles.js, backend e schema.sql.
 */
import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';
import SearchField from '../components/SearchField.jsx';

const INITIAL_FORM = { nome: '', identificador: '', senha: '', role: 'usuario', sectorIds: [] };
const PROFILE_OPTIONS = [
  { value: 'usuario', label: 'Usuário comum' },
  { value: 'gerente_setor', label: 'Gerente de setor' },
  { value: 'suporte', label: 'Suporte' }
];

// Compara nomes sem diferenciar maiúsculas nem acentos ("andre" encontra "André").
function normalize(text) {
  return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Gerencia usuários, credenciais e os setores que governam seu acesso aos manuais e provas. */
export default function Usuarios() {
  const { apiUrl, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const filteredUsers = users.filter((user) => normalize(user.nome).includes(normalize(search)));

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

  // Salva nome, perfil, identificador e setores do usuário selecionado.
  async function handleSave() {
    if (!editingUser) return;
    try {
      const response = await fetch(`${apiUrl}/api/users/${editingUser.id}`, {
        method: 'PUT', headers: createAuthHeaders(token),
        body: JSON.stringify({ nome: editingUser.nome, identificador: editingUser.identificador, role: editingUser.role, sectorIds: editingUser.sectorIds })
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

  // Operador e gerente de setor precisam de pelo menos um setor; suporte pode ficar sem nenhum.
  function SectorPicker({ value, onChange }) {
    const toggle = (id) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
    if (!sectors.length) return <p className="hint">Cadastre os setores em Configurações &gt; Setores.</p>;
    return <div className="sector-picker">{sectors.map((sector) => <label key={sector.id}>
      <input type="checkbox" checked={value.includes(sector.id)} onChange={() => toggle(sector.id)} />{sector.nome}
    </label>)}</div>;
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
        <label>Usuário para login<input value={form.identificador} onChange={(event) => updateCreateForm('identificador', event.target.value)} autoComplete="off" required /></label>
        <fieldset><legend>Setores</legend><SectorPicker value={form.sectorIds} onChange={(value) => updateCreateForm('sectorIds', value)} /></fieldset>
        <label>Senha<input type="password" value={form.senha} onChange={(event) => updateCreateForm('senha', event.target.value)} autoComplete="new-password" required /></label>
        <label>Perfil<RoleSelect value={form.role} onChange={(value) => updateCreateForm('role', value)} /></label>
        <button className="primary-button"><Plus size={18} />Cadastrar usuário</button>
      </form>
      <div className="admin-panel">
        <div className="panel-header">
          <h2>Usuários cadastrados</h2>
          <SearchField id="user-search" value={search} onChange={setSearch} placeholder="Pesquisar por nome" label="Pesquisar usuário por nome" />
        </div>
        {search && !filteredUsers.length && <p className="empty-state">Nenhum usuário encontrado com esse nome.</p>}
        <div className="table-list">
        {filteredUsers.map((user) => <div className="table-row" key={user.id}>
          {editingUser?.id === user.id ? <div className="edit-stack">
            <input value={editingUser.nome} onChange={(event) => updateEditingUser('nome', event.target.value)} />
            <input value={editingUser.identificador || ''} onChange={(event) => updateEditingUser('identificador', event.target.value)} />
            <SectorPicker value={editingUser.sectorIds} onChange={(value) => updateEditingUser('sectorIds', value)} />
            <RoleSelect value={editingUser.role} onChange={(value) => updateEditingUser('role', value)} />
          </div> : <span>{user.nome} · {PROFILE_OPTIONS.find((profile) => profile.value === user.role)?.label || user.role} · {user.setores?.length ? user.setores.map((sector) => sector.nome).join(', ') : 'Sem setor'}</span>}
          <div className="row-actions">{editingUser?.id === user.id ? <><button type="button" onClick={handleSave} aria-label="Salvar usuário"><Save size={16} /></button><button type="button" onClick={() => setEditingUser(null)} aria-label="Cancelar edição"><X size={16} /></button></> : <><button type="button" onClick={() => setEditingUser({ ...user, sectorIds: user.sector_ids || [] })} aria-label="Editar usuário"><Pencil size={16} /></button><button type="button" onClick={() => handleDelete(user)} aria-label="Remover usuário"><Trash2 size={16} /></button></>}</div>
        </div>)}
      </div></div>
    </div>
  </section>;
}
