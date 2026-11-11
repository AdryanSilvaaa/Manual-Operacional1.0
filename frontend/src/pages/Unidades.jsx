/**
 * Cadastro de unidades (filiais) com endereço completo. O setor é comum a todas as unidades; a unidade é um segundo
 * filtro: o colaborador vê o conteúdo do seu setor que foi publicado para a sua unidade ou para todas as unidades.
 * Ao digitar o CEP, o endereço é preenchido pela consulta pública do ViaCEP (se ela falhar, basta digitar à mão).
 */
import { useEffect, useRef, useState } from 'react';
import { MapPin, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';

const EMPTY_FORM = { id: null, nome: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' };
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
const formatCep = (value) => {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

/** Endereço em uma linha para a lista: "Rua X, 100 - Sala 2 - Bairro, Cidade/UF - CEP 00000-000". */
function formatAddress(unit) {
  const street = [unit.logradouro, unit.numero].filter(Boolean).join(', ');
  const city = [unit.cidade, unit.uf].filter(Boolean).join('/');
  const parts = [street, unit.complemento, [unit.bairro, city].filter(Boolean).join(', '), unit.cep && `CEP ${formatCep(unit.cep)}`];
  return parts.filter(Boolean).join(' - ');
}

export default function Unidades() {
  const { apiUrl, token } = useAuth();
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const lastCep = useRef('');
  const formRef = useRef(null);
  const editing = Boolean(form.id);

  async function loadUnits() {
    setUnits(await readResponse(await fetch(`${apiUrl}/api/units`, { headers: createAuthHeaders(token) })));
  }

  useEffect(() => { loadUnits().catch((error) => toast.error(error.message)); }, [apiUrl, token, toast]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  // Com os 8 números do CEP, preenche logradouro, bairro, cidade e UF (sem apagar o que já foi digitado).
  async function lookupCep(value) {
    const cep = onlyDigits(value);
    if (cep.length !== 8 || cep === lastCep.current) return;
    lastCep.current = cep;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!response.ok || data.erro) { toast.error('CEP não encontrado. Confira ou preencha o endereço à mão.'); return; }
      setForm((current) => ({
        ...current,
        logradouro: current.logradouro || data.logradouro || '',
        bairro: current.bairro || data.bairro || '',
        cidade: current.cidade || data.localidade || '',
        uf: current.uf || data.uf || ''
      }));
    } catch {
      // Sem acesso à consulta de CEP (rede interna, por exemplo): o endereço é digitado à mão.
    }
  }

  function startEdit(unit) {
    lastCep.current = onlyDigits(unit.cep);
    setForm({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(unit).map(([key, value]) => [key, value ?? ''])), cep: formatCep(unit.cep) });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    lastCep.current = '';
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const { id, ...fields } = form;
    setSaving(true);
    try {
      const unit = await readResponse(await fetch(`${apiUrl}/api/units${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST', headers: createAuthHeaders(token), body: JSON.stringify({ ...fields, cep: onlyDigits(fields.cep) })
      }));
      toast.success(id ? `Unidade ${unit.nome} atualizada.` : `Unidade ${unit.nome} cadastrada com sucesso.`);
      cancelEdit();
      await loadUnits();
    } catch (error) { toast.error(error.message); } finally { setSaving(false); }
  }

  async function handleDelete(unit) {
    if (!window.confirm(`Excluir a unidade ${unit.nome}?`)) return;
    try {
      await readResponse(await fetch(`${apiUrl}/api/units/${unit.id}`, { method: 'DELETE', headers: createAuthHeaders(token) }));
      if (form.id === unit.id) cancelEdit();
      toast.success(`Unidade ${unit.nome} excluída.`);
      await loadUnits();
    } catch (error) { toast.error(error.message); }
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Unidades</h1></div>
    <div className="admin-grid">
      <form key={form.id || 'nova'} ref={formRef} className="admin-panel" onSubmit={handleSubmit}>
        <h2>{editing ? `Editar ${form.nome || 'unidade'}` : 'Nova unidade'}</h2>
        <label>Nome da unidade<input value={form.nome} onChange={(event) => update('nome', event.target.value)} maxLength={120} placeholder="Ex.: Matriz, Hospital de Taipas" required /></label>
        <label>CEP<input value={form.cep} inputMode="numeric" placeholder="00000-000" maxLength={9}
          onChange={(event) => { const cep = formatCep(event.target.value); update('cep', cep); lookupCep(cep); }} /></label>
        <label>Logradouro<input value={form.logradouro} onChange={(event) => update('logradouro', event.target.value)} maxLength={160} placeholder="Rua, avenida..." /></label>
        <div className="exam-period">
          <label>Número<input value={form.numero} onChange={(event) => update('numero', event.target.value)} maxLength={20} placeholder="Ex.: 1500 ou S/N" /></label>
          <label>Complemento<input value={form.complemento} onChange={(event) => update('complemento', event.target.value)} maxLength={80} placeholder="Bloco, andar..." /></label>
        </div>
        <label>Bairro<input value={form.bairro} onChange={(event) => update('bairro', event.target.value)} maxLength={80} /></label>
        <div className="exam-period">
          <label>Cidade<input value={form.cidade} onChange={(event) => update('cidade', event.target.value)} maxLength={80} /></label>
          <label>UF<select value={form.uf} onChange={(event) => update('uf', event.target.value)}>
            <option value="">Selecione</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select></label>
        </div>
        <p className="hint">Só o nome é obrigatório. Ao digitar o CEP, o endereço é preenchido automaticamente quando possível. Depois vincule cada usuário à sua unidade em Criar / Alterar Usuários.</p>
        <div className="form-actions">
          <button className="primary-button" disabled={saving}>{editing ? <><Save size={18} />Salvar unidade</> : <><Plus size={18} />Cadastrar unidade</>}</button>
          {editing && <button type="button" className="secondary-button" onClick={cancelEdit}><X size={16} />Cancelar</button>}
        </div>
      </form>
      <div className="admin-panel"><h2>Unidades cadastradas</h2><div className="table-list">
        {units.map((unit) => <div className="table-row" key={unit.id}>
          <span><MapPin size={16} style={{ flexShrink: 0 }} /><div><strong>{unit.nome}</strong> · {plural(unit.users_count, 'usuário', 'usuários')} · {plural(unit.manuals_count, 'manual específico', 'manuais específicos')}
            <br /><small className="hint">{formatAddress(unit) || 'Endereço não informado'}</small></div></span>
          <div className="row-actions">
            <button type="button" onClick={() => startEdit(unit)} aria-label={`Editar ${unit.nome}`}><Pencil size={16} /></button>
            <button type="button" onClick={() => handleDelete(unit)} aria-label={`Excluir ${unit.nome}`} disabled={unit.users_count > 0 || unit.manuals_count > 0}
              title={unit.users_count > 0 || unit.manuals_count > 0 ? 'Retire os usuários e manuais desta unidade antes de excluir' : undefined}><Trash2 size={16} /></button>
          </div>
        </div>)}
        {!units.length && <p className="empty-state">Nenhuma unidade cadastrada.</p>}
      </div></div>
    </div>
  </section>;
}
