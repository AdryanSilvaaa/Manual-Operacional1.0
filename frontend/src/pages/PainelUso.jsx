import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Clock3, Download, UsersRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import SearchSelect from '../components/SearchSelect.jsx';
import BackButton from '../components/BackButton.jsx';
import ResultadosProvas from '../components/ResultadosProvas.jsx';
import { sectorScope } from '../utils/sectorScope.js';
import { ROLE_LABELS } from '../constants/roles.js';

const TABS = [{ id: 'uso', label: 'Uso dos manuais' }, { id: 'provas', label: 'Resultados de Provas' }];

function statusOf(row) {
  if (row.completed_at) return 'Concluído';
  if (row.first_access_at) return 'Em andamento';
  return 'Não iniciado';
}

// No painel o perfil comum aparece como operador, que é como a tela chama quem faz o treinamento.
const roleOf = (row) => (row.user_role === 'usuario' ? 'Operador' : ROLE_LABELS[row.user_role] || row.user_role || '—');

// Manual sem PDF ou sem vídeo mostra "—" na coluna da parte que não existe.
const pdfStatus = (row) => (row.has_pdf === false ? '—' : row.pdf_completed ? 'Concluído' : 'Pendente');
const videoStatus = (row) => (row.has_video === false ? '—' : `${Math.round(Number(row.video_progress))}%`);

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

export default function PainelUso() {
  const { apiUrl, token, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [manualFilter, setManualFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [tab, setTab] = useState('uso');

  useEffect(() => {
    fetch(`${apiUrl}/api/progress/report`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setRows).catch((requestError) => setError(requestError.message));
  }, [apiUrl, token]);

  const manuals = useMemo(() => [...new Map(rows.map((row) => [row.manual_id, row.manual_title])).entries()], [rows]);
  // Um manual pode valer para vários setores: a linha traz em sector_names os setores pelos quais a pessoa o recebe.
  const sectorsOf = (row) => row.sector_names || [row.sector_name];
  const scope = sectorScope(user, rows.flatMap(sectorsOf));
  const sector = scope.locked || sectorFilter;
  const inSector = rows.filter((row) => !sector || sectorsOf(row).includes(sector));
  // As listas de manual e pessoa mostram só o que existe no setor escolhido.
  const byLabel = (a, b) => a.label.localeCompare(b.label, 'pt-BR');
  const manualOptions = [...new Map(inSector.map((row) => [String(row.manual_id), row.manual_title])).entries()].map(([value, label]) => ({ value, label })).sort(byLabel);
  const operatorOptions = [...new Map(inSector.map((row) => [String(row.user_id), row.user_name])).entries()].map(([value, label]) => ({ value, label })).sort(byLabel);
  const filtered = inSector.filter((row) => (!manualFilter || String(row.manual_id) === manualFilter) && (!operatorFilter || String(row.user_id) === operatorFilter));
  const completed = filtered.filter((row) => row.completed_at).length;
  const started = filtered.filter((row) => row.first_access_at).length;
  const completionRate = filtered.length ? Math.round((completed / filtered.length) * 100) : 0;
  const manualStats = manuals.map(([id, title]) => {
    const items = filtered.filter((row) => Number(row.manual_id) === Number(id));
    const count = items.filter((row) => row.completed_at).length;
    return { id, title, total: items.length, rate: items.length ? Math.round((count / items.length) * 100) : 0 };
  }).filter((item) => item.total > 0);

  function exportCsv() {
    const columns = ['Pessoa', 'Perfil', 'Setor', 'Manual', 'Status', 'PDF', 'Video', 'Ultimo acesso', 'Conclusao'];
    const values = filtered.map((row) => [row.user_name, roleOf(row), row.sector_name, row.manual_title, statusOf(row), pdfStatus(row), videoStatus(row), formatDate(row.last_access_at), formatDate(row.completed_at)]);
    const csv = [columns, ...values].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `painel-uso-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section className="page-section usage-dashboard">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Acompanhamento</p><h1>Painel de uso</h1><p>Progresso de operadores, gestores e suporte nos manuais e resultados das provas.</p></div>
    <div className="tab-list" role="tablist">{TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'tab active' : 'tab'} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {tab === 'provas' ? <ResultadosProvas /> : <>
    {error && <p className="alert">{error}</p>}
    <div className="dashboard-filters">
      <div className="filter-field"><label htmlFor="manual-search">Manual</label><SearchSelect id="manual-search" value={manualFilter} onChange={setManualFilter} options={manualOptions} placeholder="Pesquisar manual pelo nome" label="Pesquisar manual pelo nome" allLabel="Todos os manuais" emptyText="Nenhum manual encontrado" /></div>
      <div className="filter-field"><label htmlFor="operator-search">Pessoa</label><SearchSelect id="operator-search" value={operatorFilter} onChange={setOperatorFilter} options={operatorOptions} placeholder="Pesquisar pessoa pelo nome" label="Pesquisar pessoa pelo nome" allLabel="Todas as pessoas" emptyText="Nenhuma pessoa encontrada" /></div>
      <div className="filter-field"><label htmlFor="sector-search">Setor</label><SearchSelect id="sector-search" value={sector} onChange={(value) => { setSectorFilter(value); setManualFilter(''); setOperatorFilter(''); }} options={scope.options} placeholder="Pesquisar setor pelo nome" label="Pesquisar setor pelo nome" allLabel={scope.allLabel} emptyText="Nenhum setor encontrado" locked={Boolean(scope.locked)} /></div>
      <button type="button" className="primary-button export-button" onClick={exportCsv}><Download size={17} /> Exportar CSV</button>
    </div>
    <div className="metric-grid">
      <article className="metric-card"><UsersRound /><div><strong>{new Set(filtered.map((row) => row.user_id)).size}</strong><span>Pessoas</span></div></article>
      <article className="metric-card"><Clock3 /><div><strong>{started}</strong><span>Leituras iniciadas</span></div></article>
      <article className="metric-card"><CheckCircle2 /><div><strong>{completed}</strong><span>Conclusões</span></div></article>
      <article className="metric-card"><BarChart3 /><div><strong>{completionRate}%</strong><span>Índice de conclusão</span></div></article>
    </div>
    <div className="dashboard-panel"><h2>Conclusão por manual</h2>{manualStats.length ? <div className="bar-chart">{manualStats.map((item) => <div className="bar-row" key={item.id}><span title={item.title}>{item.title}</span><div className="bar-track"><i style={{ width: `${item.rate}%` }} /></div><strong>{item.rate}%</strong></div>)}</div> : <p className="empty-state">Nenhum dado para os filtros escolhidos.</p>}</div>
    <div className="dashboard-panel"><h2>Detalhamento por pessoa</h2><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Setor</th><th>Manual</th><th>Status</th><th>PDF</th><th>Vídeo</th><th>Último acesso</th><th>Conclusão</th></tr></thead><tbody>
      {filtered.map((row) => <tr key={`${row.user_id}-${row.manual_id}`}><td>{row.user_name}</td><td>{roleOf(row)}</td><td>{row.sector_name}</td><td>{row.manual_title}</td><td><span className={`status-pill status-${statusOf(row).toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>{statusOf(row)}</span></td><td>{pdfStatus(row)}</td><td>{videoStatus(row)}</td><td>{formatDate(row.last_access_at)}</td><td>{formatDate(row.completed_at)}</td></tr>)}
    </tbody></table></div></div>
    </>}
  </section>;
}
