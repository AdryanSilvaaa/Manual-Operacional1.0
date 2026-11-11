/**
 * CRUD de usuários, perfis, setores e unidades (Admin e Administrador de cadastros).
 * Com uma unidade só na empresa, o campo de unidades some e o backend usa essa unidade automaticamente.
 * Perfis e permissões vêm de constants/roles.js; quem não é Admin não vê o perfil Admin nem altera usuários Admin.
 */
import { useEffect, useState } from 'react';
import { CircleHelp, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';
import SearchField from '../components/SearchField.jsx';
import ImportarUsuarios from '../components/ImportarUsuarios.jsx';
import SectorPicker from '../components/SectorPicker.jsx';
import { assignableRoles, can, canManageUser, PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_LABELS, roleLabel } from '../constants/roles.js';

const INITIAL_FORM = { nome: '', identificador: '', senha: '', role: 'usuario', sectorIds: [], unitIds: [] };

// Texto da lista: setores e, quando a empresa tem mais de uma unidade, as unidades.
const unitsText = (user) => (user.unidades?.length ? user.unidades.map((unit) => unit.nome).join(', ')
  : can(user, PERMISSIONS.ALL_UNITS) ? 'Todas as unidades' : 'Sem unidade');

// Compara nomes sem diferenciar maiúsculas nem acentos ("andre" encontra "André").
function normalize(text) {
  return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Gerencia usuários, credenciais e os setores que governam seu acesso aos manuais e provas. */
export default function Usuarios() {
  const { apiUrl, token, user: currentUser } = useAuth();
  const roleOptions = assignableRoles(currentUser);
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [units, setUnits] = useState([]);
  const hasUnits = units.length > 1;
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const toast = useToast();
  const [search, setSearch] = useState('');
  const filteredUsers = users.filter((user) => normalize(user.nome).includes(normalize(search)));

  async function loadData() {
    const headers = createAuthHeaders(token);
    const [usersResponse, sectorsResponse, unitsResponse] = await Promise.all([
      fetch(`${apiUrl}/api/users`, { headers }), fetch(`${apiUrl}/api/sectors`, { headers }), fetch(`${apiUrl}/api/units`, { headers })
    ]);
    setUsers(await readResponse(usersResponse));
    setSectors(await readResponse(sectorsResponse));
    setUnits(await readResponse(unitsResponse));
  }

  useEffect(() => { loadData().catch((error) => toast.error(error.message)); }, [apiUrl, token, toast]);

  // Mantém o formulário de criação independente da edição em linha.
  function updateCreateForm(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function updateEditingUser(field, value) { setEditingUser((current) => ({ ...current, [field]: value })); }

  async function handleCreate(event) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify(form)
      });
      await readResponse(response);
      setForm(INITIAL_FORM);
      toast.success('Usuário cadastrado com sucesso.');
      await loadData();
    } catch (error) { toast.error(error.message); }
  }

  // Salva nome, perfil, identificador, setores e unidades do usuário selecionado; a senha só vai quando preenchida.
  async function handleSave() {
    if (!editingUser) return;
    try {
      const response = await fetch(`${apiUrl}/api/users/${editingUser.id}`, {
        method: 'PUT', headers: createAuthHeaders(token),
        body: JSON.stringify({ nome: editingUser.nome, identificador: editingUser.identificador, role: editingUser.role, sectorIds: editingUser.sectorIds, unitIds: editingUser.unitIds, ...(editingUser.senha ? { senha: editingUser.senha } : {}) })
      });
      await readResponse(response);
      setEditingUser(null);
      toast.success(editingUser.senha ? 'Usuário e senha atualizados com sucesso.' : 'Usuário atualizado com sucesso.');
      await loadData();
    } catch (error) { toast.error(error.message); }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Remover o usuário ${user.nome}?`)) return;
    try {
      const response = await fetch(`${apiUrl}/api/users/${user.id}`, {
        method: 'DELETE', headers: createAuthHeaders(token)
      });
      await readResponse(response);
      toast.success(`Usuário ${user.nome} removido.`);
      await loadData();
    } catch (error) { toast.error(error.message); }
  }

  // Passar o mouse no campo ou numa opção mostra o que o perfil faz (title); abaixo do campo fica a mesma explicação.
  function RoleSelect({ value, onChange, label }) {
    return <select value={value} title={ROLE_DESCRIPTIONS[value]} aria-label={label} onChange={(event) => onChange(event.target.value)}>
      {roleOptions.map((role) => <option key={role} value={role} title={ROLE_DESCRIPTIONS[role]}>{ROLE_LABELS[role]}</option>)}
    </select>;
  }

  function RoleDescription({ role }) {
    return <p className="role-description"><strong>{ROLE_LABELS[role]}:</strong> {ROLE_DESCRIPTIONS[role]}</p>;
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Criar / Alterar Usuários</h1></div>
    <div className="admin-grid">
      <form className="admin-panel" onSubmit={handleCreate}>
        <h2>Novo usuário</h2>
        <label>Nome<input value={form.nome} onChange={(event) => updateCreateForm('nome', event.target.value)} required /></label>
        <label>Usuário para login<input value={form.identificador} onChange={(event) => updateCreateForm('identificador', event.target.value)} autoComplete="off" required /></label>
        <fieldset><legend>Setores</legend><SectorPicker sectors={sectors} value={form.sectorIds} onChange={(value) => updateCreateForm('sectorIds', value)} /></fieldset>
        {hasUnits && <fieldset><legend>Unidades</legend><SectorPicker sectors={units} value={form.unitIds} onChange={(value) => updateCreateForm('unitIds', value)} />
          <span className="hint">A pessoa vê os manuais do seu setor publicados para a sua unidade ou para todas as unidades.</span></fieldset>}
        <label>Senha<input type="password" value={form.senha} onChange={(event) => updateCreateForm('senha', event.target.value)} autoComplete="new-password" required /></label>
        <label>Perfil<RoleSelect value={form.role} onChange={(value) => updateCreateForm('role', value)} /></label>
        <RoleDescription role={form.role} />
        <details className="role-legend">
          <summary><CircleHelp size={16} />Ver o que cada perfil faz</summary>
          <dl>{roleOptions.map((role) => <div key={role}><dt>{ROLE_LABELS[role]}</dt><dd>{ROLE_DESCRIPTIONS[role]}</dd></div>)}</dl>
        </details>
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
            <SectorPicker sectors={sectors} value={editingUser.sectorIds} onChange={(value) => updateEditingUser('sectorIds', value)} />
            {hasUnits && <><strong className="hint">Unidades</strong><SectorPicker sectors={units} value={editingUser.unitIds} onChange={(value) => updateEditingUser('unitIds', value)} /></>}
            <RoleSelect value={editingUser.role} onChange={(value) => updateEditingUser('role', value)} label="Perfil" />
            <RoleDescription role={editingUser.role} />
            <input type="password" autoComplete="new-password" value={editingUser.senha} onChange={(event) => updateEditingUser('senha', event.target.value)} placeholder="Nova senha (em branco mantém a atual)" aria-label="Nova senha" />
            {editingUser.senha && <p className="hint">Use pelo menos 8 caracteres, uma letra e um número.</p>}
          </div> : <span>{user.nome} · {roleLabel(user.role)} · {user.setores?.length ? user.setores.map((sector) => sector.nome).join(', ') : 'Sem setor'}{hasUnits && ` · ${unitsText(user)}`}</span>}
          <div className="row-actions">{editingUser?.id === user.id ? <><button type="button" onClick={handleSave} aria-label="Salvar usuário"><Save size={16} /></button><button type="button" onClick={() => setEditingUser(null)} aria-label="Cancelar edição"><X size={16} /></button></> : canManageUser(currentUser, user) && <><button type="button" onClick={() => setEditingUser({ ...user, sectorIds: user.sector_ids || [], unitIds: user.unit_ids || [], senha: '' })} aria-label="Editar usuário"><Pencil size={16} /></button><button type="button" onClick={() => handleDelete(user)} aria-label="Remover usuário"><Trash2 size={16} /></button></>}</div>
        </div>)}
      </div></div>
    </div>
    <ImportarUsuarios apiUrl={apiUrl} token={token} sectors={sectors} units={units} onImported={loadData} />
  </section>;
}
