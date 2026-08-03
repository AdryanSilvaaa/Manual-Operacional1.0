/**
 * Cadastro simples de setores usado para vincular pessoas e materiais.
 * Altere o formulário aqui e as regras de persistência no controller/model de setores.
 */
import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';

/** Permite ao suporte manter a lista de setores corporativos. */
export default function Setores() {
  const { apiUrl, token } = useAuth();
  const [setores, setSetores] = useState([]);
  const [nome, setNome] = useState('');
  const [message, setMessage] = useState('');

  // Consulta os setores para a tabela e para os demais cadastros.
  async function loadSectors() {
    const response = await fetch(`${apiUrl}/api/sectors`, {
      headers: createAuthHeaders(token)
    });
    setSetores(await readResponse(response));
  }

  useEffect(() => {
    loadSectors().catch((error) => setMessage(error.message));
  }, [apiUrl, token]);

  // Cria um setor reutilizável em usuários e manuais.
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/sectors`, {
        method: 'POST',
        headers: createAuthHeaders(token),
        body: JSON.stringify({ nome })
      });
      const sector = await readResponse(response);
      setNome('');
      setMessage(`Setor ${sector.nome} cadastrado com sucesso.`);
      await loadSectors();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="admin-page">
      <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Cadastrar Setor</h1></div>
      {message && <p className="notice">{message}</p>}
      <div className="admin-grid">
        <form className="admin-panel" onSubmit={handleSubmit}>
          <h2>Novo setor</h2>
          <label>Nome do setor<input value={nome} onChange={(event) => setNome(event.target.value)} required /></label>
          <button className="primary-button"><Plus size={18} />Cadastrar setor</button>
        </form>
        <div className="admin-panel"><h2>Setores cadastrados</h2><div className="table-list">
          {setores.map((setor) => <div className="table-row" key={setor.id}><span><Building2 size={16} />{setor.nome}</span></div>)}
        </div></div>
      </div>
    </section>
  );
}
