/**
 * Cadastro de usuários em massa por planilha CSV (preenchida e salva no Excel).
 * Fluxo: baixar o modelo, escolher o arquivo, conferir as linhas (a validação é do servidor, em
 * POST /api/users/import com dryRun) e cadastrar as válidas. Ao final, baixa a lista de acessos com as
 * senhas provisórias geradas, que só aparecem nesse momento.
 */
import { useRef, useState } from 'react';
import { Download, Upload, UserPlus } from 'lucide-react';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { downloadCsv, parseCsv, readTextFile } from '../utils/csv.js';

// Nomes de coluna aceitos no cabeçalho, comparados sem acento e sem maiúsculas.
const HEADER_ALIASES = {
  nome: 'nome', login: 'login', usuario: 'login', 'usuario para login': 'login', identificador: 'login',
  perfil: 'perfil', setor: 'setores', setores: 'setores', senha: 'senha'
};

function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Transforma as linhas do CSV em objetos { linha, nome, login, perfil, setores, senha }, ignorando linhas vazias. */
function toImportRows(table) {
  const [header = [], ...lines] = table;
  const columns = header.map((name) => HEADER_ALIASES[normalize(name)]);
  if (!columns.includes('nome') || !columns.includes('login')) {
    throw new Error('A planilha precisa das colunas "nome" e "login". Baixe o modelo e use o mesmo cabeçalho.');
  }
  return lines
    .map((cells, index) => ({ cells, linha: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim()))
    .map(({ cells, linha }) => Object.fromEntries([
      ['linha', linha],
      ...columns.map((key, column) => [key, cells[column] ?? '']).filter(([key]) => key)
    ]));
}

function ImportTable({ rows }) {
  return <div className="report-table-wrap"><table className="report-table">
    <thead><tr><th>Linha</th><th>Nome</th><th>Login</th><th>Perfil</th><th>Setores</th><th>Situação</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.linha}>
      <td>{row.linha}</td><td>{row.nome}</td><td>{row.login}</td><td>{row.perfil}</td><td>{row.setores.join(', ')}</td>
      <td className={row.status === 'ok' ? 'import-ok' : 'import-error'}>{row.status === 'ok' ? 'Pronto' : row.erro}</td>
    </tr>)}</tbody>
  </table></div>;
}

export default function ImportarUsuarios({ apiUrl, token, sectors, onImported }) {
  const [rows, setRows] = useState([]);
  const [check, setCheck] = useState(null);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const errors = check ? check.total - check.validos : 0;

  // O modelo já traz nomes de setores que existem, para servir de exemplo de escrita.
  function downloadTemplate() {
    const [first = 'Nome do setor', second] = sectors.map((sector) => sector.nome);
    downloadCsv('modelo-importacao-usuarios.csv', [
      ['nome', 'login', 'perfil', 'setores', 'senha'],
      ['Maria da Silva', 'maria.silva', 'Usuário comum', first, ''],
      ['João Souza', 'joao.souza', 'Gerente de setor', second ? `${first}, ${second}` : first, '']
    ]);
  }

  async function send(body) {
    const response = await fetch(`${apiUrl}/api/users/import`, {
      method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify(body)
    });
    return readResponse(response);
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setCheck(null); setResult(null); setRows([]); setFileName(file.name);
    setBusy(true);
    try {
      const parsed = toImportRows(parseCsv(await readTextFile(file)));
      if (!parsed.length) throw new Error('A planilha não tem usuários abaixo do cabeçalho.');
      setCheck(await send({ rows: parsed, dryRun: true }));
      setRows(parsed);
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  async function importValid() {
    setBusy(true); setError('');
    try {
      setResult(await send({ rows }));
      setCheck(null); setRows([]);
      await onImported?.();
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  function downloadAccesses() {
    downloadCsv(`acessos-criados-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['nome', 'login', 'senha provisória', 'perfil', 'setores'],
      ...result.acessos.map((access) => [access.nome, access.login, access.senha || '(a da planilha)', access.perfil, access.setores.join(', ')])
    ]);
  }

  return <div className="admin-panel import-panel">
    <h2>Importar usuários por planilha</h2>
    <p className="hint">Baixe o modelo, preencha no Excel uma pessoa por linha e salve como CSV. Depois escolha o arquivo e confira antes de cadastrar.</p>
    <ul className="hint import-rules">
      <li><strong>perfil:</strong> Usuário comum, Gerente de setor, Editor de conteúdo ou Suporte. Vazio vira Usuário comum.</li>
      <li><strong>setores:</strong> nomes iguais aos de Configurações &gt; Setores, separados por vírgula.</li>
      <li><strong>senha:</strong> deixe em branco para o sistema gerar uma senha provisória.</li>
    </ul>
    <div className="import-actions">
      <button type="button" className="secondary-button" onClick={downloadTemplate}><Download size={16} />Baixar modelo</button>
      <button type="button" className="primary-button" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={16} />Escolher planilha</button>
      <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={chooseFile} />
    </div>
    {busy && <p className="hint">Processando a planilha...</p>}
    {error && <p className="alert">{error}</p>}
    {check && <>
      <p className={errors ? 'alert' : 'notice'}>
        {fileName}: {check.validos} de {check.total} {check.total === 1 ? 'linha pronta' : 'linhas prontas'} para cadastrar.
        {errors > 0 && ' As linhas com erro serão ignoradas: corrija na planilha e importe de novo depois.'}
      </p>
      <ImportTable rows={check.rows} />
      <div className="import-actions">
        <button type="button" className="primary-button" onClick={importValid} disabled={busy || !check.validos}><UserPlus size={16} />Cadastrar {check.validos} {check.validos === 1 ? 'usuário' : 'usuários'}</button>
      </div>
    </>}
    {result && <>
      <p className="notice">{result.criados} {result.criados === 1 ? 'usuário cadastrado' : 'usuários cadastrados'} com sucesso.</p>
      {result.acessos.some((access) => access.senha) && <p className="alert">Baixe agora a lista de acessos: as senhas provisórias não aparecem de novo.</p>}
      <div className="import-actions">
        <button type="button" className="primary-button" onClick={downloadAccesses}><Download size={16} />Baixar lista de acessos</button>
      </div>
    </>}
  </div>;
}
