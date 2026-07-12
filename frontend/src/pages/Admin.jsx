import { useEffect, useState } from 'react';
import { Boxes, Check, Pencil, Plus, Trash2, UploadCloud, UsersRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const emptySystem = {
  nome: '',
  resumo: ''
};

const emptyManual = {
  systemId: '',
  titulo: '',
  descricao: '',
  pdf: null,
  video: null,
  allowedUsers: []
};

export default function Admin() {
  const { apiUrl, token } = useAuth();
  const [systems, setSystems] = useState([]);
  const [manuals, setManuals] = useState([]);
  const [users, setUsers] = useState([]);
  const [systemForm, setSystemForm] = useState(emptySystem);
  const [editingSystem, setEditingSystem] = useState(null);
  const [manualForm, setManualForm] = useState(emptyManual);
  const [userForm, setUserForm] = useState({ nome: '', email: '', senha: '', role: 'usuario' });
  const [message, setMessage] = useState('');

  async function authorizedFetch(path, options = {}) {
    return fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
  }

  async function loadData() {
    const [systemsResponse, manualsResponse, usersResponse] = await Promise.all([
      authorizedFetch('/api/systems'),
      authorizedFetch('/api/manuals'),
      authorizedFetch('/api/users')
    ]);
    setSystems(await systemsResponse.json());
    setManuals(await manualsResponse.json());
    setUsers(await usersResponse.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSystemSubmit(event) {
    event.preventDefault();
    setMessage('');

    const response = await authorizedFetch('/api/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(systemForm)
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.message || 'Nao foi possivel cadastrar o sistema');
      return;
    }

    setSystemForm(emptySystem);
    setMessage('Sistema cadastrado com sucesso.');
    await loadData();
  }

  async function saveSystemEdit(id) {
    setMessage('');

    const response = await authorizedFetch(`/api/systems/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingSystem)
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.message || 'Nao foi possivel editar o sistema');
      return;
    }

    setEditingSystem(null);
    setMessage('Sistema atualizado com sucesso.');
    await loadData();
  }

  async function handleManualSubmit(event) {
    event.preventDefault();
    setMessage('');

    const formData = new FormData();
    formData.append('systemId', manualForm.systemId);
    formData.append('titulo', manualForm.titulo);
    formData.append('descricao', manualForm.descricao);
    formData.append('pdf', manualForm.pdf);
    formData.append('video', manualForm.video);
    formData.append('allowedUsers', manualForm.allowedUsers.join(','));

    const response = await authorizedFetch('/api/manuals', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.message || 'Nao foi possivel cadastrar o manual');
      return;
    }

    setManualForm(emptyManual);
    setMessage('Manual cadastrado com sucesso.');
    await loadData();
  }

  async function handleUserSubmit(event) {
    event.preventDefault();
    setMessage('');

    const response = await authorizedFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm)
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.message || 'Nao foi possivel cadastrar o usuario');
      return;
    }

    setUserForm({ nome: '', email: '', senha: '', role: 'usuario' });
    setMessage('Usuario cadastrado com sucesso.');
    await loadData();
  }

  async function updateManualSystem(manualId, systemId) {
    const formData = new FormData();
    formData.append('systemId', systemId);

    await authorizedFetch(`/api/manuals/${manualId}`, {
      method: 'PUT',
      body: formData
    });
    await loadData();
  }

  async function removeSystem(id) {
    await authorizedFetch(`/api/systems/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function removeManual(id) {
    await authorizedFetch(`/api/manuals/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function removeUser(id) {
    await authorizedFetch(`/api/users/${id}`, { method: 'DELETE' });
    await loadData();
  }

  function toggleAllowedUser(id) {
    const current = manualForm.allowedUsers;
    setManualForm({
      ...manualForm,
      allowedUsers: current.includes(id)
        ? current.filter((userId) => userId !== id)
        : [...current, id]
    });
  }

  return (
    <section className="admin-page">
      <div className="page-heading">
        <p className="eyebrow">Painel do gerente</p>
        <h1>Administre sistemas, manuais e usuarios</h1>
      </div>

      {message && <p className="notice">{message}</p>}

      <div className="admin-grid">
        <form className="admin-panel" onSubmit={handleSystemSubmit}>
          <div className="section-title">
            <Boxes size={20} />
            <h2>Novo sistema</h2>
          </div>

          <label>
            Nome do sistema
            <input
              value={systemForm.nome}
              onChange={(event) => setSystemForm({ ...systemForm, nome: event.target.value })}
              required
            />
          </label>

          <label>
            Resumo/legenda
            <textarea
              value={systemForm.resumo}
              onChange={(event) => setSystemForm({ ...systemForm, resumo: event.target.value })}
            />
          </label>

          <button className="primary-button" type="submit">
            <Plus size={18} />
            Cadastrar sistema
          </button>
        </form>

        <form className="admin-panel" onSubmit={handleManualSubmit}>
          <div className="section-title">
            <UploadCloud size={20} />
            <h2>Novo manual</h2>
          </div>

          <label>
            Sistema vinculado
            <select
              value={manualForm.systemId}
              onChange={(event) => setManualForm({ ...manualForm, systemId: event.target.value })}
              required
            >
              <option value="">Selecione um sistema</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>{system.nome}</option>
              ))}
            </select>
          </label>

          <label>
            Titulo
            <input
              value={manualForm.titulo}
              onChange={(event) => setManualForm({ ...manualForm, titulo: event.target.value })}
              required
            />
          </label>

          <label>
            Descricao
            <textarea
              value={manualForm.descricao}
              onChange={(event) => setManualForm({ ...manualForm, descricao: event.target.value })}
            />
          </label>

          <label>
            PDF
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setManualForm({ ...manualForm, pdf: event.target.files[0] })}
              required
            />
          </label>

          <label>
            Video
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(event) => setManualForm({ ...manualForm, video: event.target.files[0] })}
              required
            />
          </label>

          <fieldset>
            <legend>Usuarios com acesso</legend>
            <p className="hint">Sem selecao, o manual fica disponivel para todos.</p>
            <div className="checkbox-list">
              {users.filter((user) => user.role === 'usuario').map((user) => (
                <label key={user.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={manualForm.allowedUsers.includes(user.id)}
                    onChange={() => toggleAllowedUser(user.id)}
                  />
                  {user.nome}
                </label>
              ))}
            </div>
          </fieldset>

          <button className="primary-button" type="submit">
            <Plus size={18} />
            Cadastrar manual
          </button>
        </form>

        <form className="admin-panel" onSubmit={handleUserSubmit}>
          <div className="section-title">
            <UsersRound size={20} />
            <h2>Novo usuario</h2>
          </div>

          <label>
            Nome
            <input
              value={userForm.nome}
              onChange={(event) => setUserForm({ ...userForm, nome: event.target.value })}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={userForm.email}
              onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={userForm.senha}
              onChange={(event) => setUserForm({ ...userForm, senha: event.target.value })}
              required
            />
          </label>

          <label>
            Perfil
            <select
              value={userForm.role}
              onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
            >
              <option value="usuario">Usuario comum</option>
              <option value="gerente">Gerente</option>
            </select>
          </label>

          <button className="primary-button" type="submit">
            <Plus size={18} />
            Cadastrar usuario
          </button>
        </form>
      </div>

      <div className="management-grid">
        <div className="admin-panel">
          <h2>Sistemas cadastrados</h2>
          <div className="table-list">
            {systems.map((system) => (
              <div key={system.id} className="table-row table-row-editable">
                {editingSystem?.id === system.id ? (
                  <div className="inline-edit">
                    <input
                      value={editingSystem.nome}
                      onChange={(event) => setEditingSystem({ ...editingSystem, nome: event.target.value })}
                    />
                    <input
                      value={editingSystem.resumo || ''}
                      onChange={(event) => setEditingSystem({ ...editingSystem, resumo: event.target.value })}
                    />
                  </div>
                ) : (
                  <span>{system.nome} · {system.manuals_count || 0} manuais</span>
                )}

                <div className="row-actions">
                  {editingSystem?.id === system.id ? (
                    <>
                      <button type="button" aria-label="Salvar sistema" onClick={() => saveSystemEdit(system.id)}>
                        <Check size={17} />
                      </button>
                      <button type="button" aria-label="Cancelar edicao" onClick={() => setEditingSystem(null)}>
                        <X size={17} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" aria-label="Editar sistema" onClick={() => setEditingSystem(system)}>
                        <Pencil size={17} />
                      </button>
                      <button type="button" aria-label="Remover sistema" onClick={() => removeSystem(system.id)}>
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <h2>Manuais cadastrados</h2>
          <div className="table-list">
            {manuals.map((manual) => (
              <div key={manual.id} className="table-row table-row-editable">
                <span>{manual.titulo}</span>
                <select
                  value={manual.system_id || ''}
                  onChange={(event) => updateManualSystem(manual.id, event.target.value)}
                >
                  <option value="">Sem sistema</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>{system.nome}</option>
                  ))}
                </select>
                <button type="button" aria-label="Remover manual" onClick={() => removeManual(manual.id)}>
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <h2>Usuarios</h2>
          <div className="table-list">
            {users.map((user) => (
              <div key={user.id} className="table-row">
                <span>{user.nome} · {user.role}</span>
                <button type="button" aria-label="Remover usuario" onClick={() => removeUser(user.id)}>
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
