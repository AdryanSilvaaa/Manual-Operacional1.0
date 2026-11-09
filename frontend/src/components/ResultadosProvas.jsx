/**
 * Aba "Resultados de Provas" do Painel de Uso.
 * Gerente de setor recebe só os próprios setores; suporte recebe todos. Filtro de setor em utils/sectorScope.js.
 */
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { sectorScope } from '../utils/sectorScope.js';
import { downloadCsv } from '../utils/csv.js';
import SearchSelect from './SearchSelect.jsx';
import { OPTION_LETTERS, QUESTION_TYPES, formatDateTime } from '../constants/exam.js';

const ALL_SECTORS = 'Todos os setores';

function percent(correct, total) {
  return total ? Math.round((correct / total) * 100) : null;
}

function examStatus(exam) {
  const now = new Date();
  if (now < new Date(exam.starts_at)) return 'Agendada';
  if (exam.ends_at && now > new Date(exam.ends_at)) return 'Encerrada';
  return 'Em andamento';
}

// Prova de manual pode não ter prazo final.
const examPeriod = (exam) => (exam.ends_at ? `${formatDateTime(exam.starts_at)} a ${formatDateTime(exam.ends_at)}` : `Desde ${formatDateTime(exam.starts_at)}, sem prazo final`);
// Prova de manual vale para os setores do manual (sector_names); a avulsa tem um setor ou "Todos os setores".
const examSectors = (exam) => exam.sector_names || [exam.sector_name];

// Situação da entrega: em andamento só enquanto a pessoa ainda está com a prova aberta e o período não acabou.
const SUBMISSION_LABELS = { enviada: 'Enviada', encerrada: 'Encerrada ao sair da página', em_andamento: 'Em andamento' };
const submissionLabel = (submission) => SUBMISSION_LABELS[submission.status] || 'Enviada';
const isFinished = (submission) => submission.status !== 'em_andamento';

function scoreText(submission) {
  const score = percent(submission.objective_correct, submission.objective_total);
  return score === null ? 'Só respostas abertas' : `${score}%`;
}

/** Uma linha por resposta, para filtrar por prova, colaborador ou pergunta no Excel. */
function exportAnswers(exams) {
  const columns = ['Prova', 'Setor', 'Período', 'Status', 'Colaborador', 'Situação da entrega', 'Entregue em', 'Acertos', 'Nota', 'Nº', 'Pergunta', 'Tipo', 'Resposta', 'Resposta correta', 'Resultado'];
  const rows = [];
  for (const exam of exams) {
    const period = examPeriod(exam);
    for (const submission of exam.submissions.filter(isFinished)) {
      const hits = submission.objective_total ? `${submission.objective_correct} de ${submission.objective_total}` : '—';
      exam.questions.forEach((question, index) => {
        const answer = submission.answers.find((item) => Number(item.question_id) === Number(question.id));
        const base = [exam.titulo, exam.sector_name, period, examStatus(exam), submission.user_name, submissionLabel(submission), formatDateTime(submission.submitted_at), hits, scoreText(submission), index + 1, question.prompt];
        if (question.type === QUESTION_TYPES.OPEN) {
          rows.push([...base, 'Aberta', answer?.answer_text || '—', '—', '—']);
          return;
        }
        const selected = answer?.selected_option;
        const chosen = selected === null || selected === undefined ? '—' : `${OPTION_LETTERS[selected]}) ${question.options[selected]}`;
        const right = `${OPTION_LETTERS[question.correct_option]}) ${question.options[question.correct_option]}`;
        rows.push([...base, 'Múltipla escolha', chosen, right, Number(selected) === Number(question.correct_option) ? 'Certa' : 'Errada']);
      });
    }
  }
  downloadCsv(`respostas-provas-${new Date().toISOString().slice(0, 10)}.csv`, [columns, ...rows]);
}

function AnswerList({ exam, submission }) {
  return <ol className="exam-answers">
    {exam.questions.map((question) => {
      const answer = submission.answers.find((item) => Number(item.question_id) === Number(question.id));
      if (question.type === QUESTION_TYPES.OPEN) {
        return <li key={question.id}><strong>{question.prompt}</strong><p>{answer?.answer_text || '—'}</p></li>;
      }
      const selected = answer?.selected_option;
      const correct = Number(selected) === Number(question.correct_option);
      return <li key={question.id}>
        <strong>{question.prompt}</strong>
        <p>Resposta: {selected === null || selected === undefined ? '—' : `${OPTION_LETTERS[selected]}) ${question.options[selected]}`}
          {' '}<span className={correct ? 'answer-right' : 'answer-wrong'}>{correct ? 'Certa' : `Errada (correta: ${OPTION_LETTERS[question.correct_option]})`}</span></p>
      </li>;
    })}
  </ol>;
}

export default function ResultadosProvas() {
  const { apiUrl, token, user } = useAuth();
  const [exams, setExams] = useState(null);
  const [error, setError] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [openSubmission, setOpenSubmission] = useState(null);

  useEffect(() => {
    fetch(`${apiUrl}/api/exams/results`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setExams).catch((requestError) => setError(requestError.message));
  }, [apiUrl, token]);

  if (error) return <p className="alert">{error}</p>;
  if (!exams) return <p className="empty-state">Carregando resultados...</p>;
  if (!exams.length) return <p className="empty-state">Nenhuma prova criada ainda.</p>;

  const scope = sectorScope(user, [...new Set(exams.flatMap(examSectors))].filter((name) => name !== ALL_SECTORS));
  const sector = scope.locked || sectorFilter;
  // Provas para todos os setores também valem para o setor escolhido.
  const filtered = exams.filter((exam) => !sector || examSectors(exam).includes(sector) || exam.sector_name === ALL_SECTORS);

  return <>
    <div className="dashboard-filters">
      {(scope.locked || scope.options.length > 1) && <div className="filter-field"><label htmlFor="exam-sector-search">Setor</label><SearchSelect id="exam-sector-search" value={sector} onChange={setSectorFilter} options={scope.options} placeholder="Pesquisar setor pelo nome" label="Pesquisar setor pelo nome" allLabel={scope.allLabel} emptyText="Nenhum setor encontrado" locked={Boolean(scope.locked)} /></div>}
      <button type="button" className="primary-button export-button" onClick={() => exportAnswers(filtered)} disabled={!filtered.some((exam) => exam.submissions.length)}><Download size={17} /> Exportar CSV</button>
    </div>
    {filtered.map((exam) => {
      const finished = exam.submissions.filter(isFinished);
      const scores = finished.map((item) => percent(item.objective_correct, item.objective_total)).filter((value) => value !== null);
      const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
      // As respostas abertas ficam fora da tabela para não depender da rolagem horizontal no celular.
      const shownSubmission = exam.submissions.find((submission) => openSubmission === `${exam.id}-${submission.id}`);
      return <div className="dashboard-panel" key={exam.id}>
        <h2>{exam.titulo}</h2>
        <p className="exam-summary">
          <span>{exam.sector_name}</span>
          {exam.manual_id && <span>Manual {exam.manual_titulo} · {exam.required ? 'Obrigatória' : 'Não obrigatória'}</span>}
          {exam.assignee_names?.length > 0 && <span>Aplicada para: {exam.assignee_names.join(', ')}</span>}
          <span>{examPeriod(exam)} · {examStatus(exam)}</span>
          <span>{finished.length} de {exam.collaborators} colaboradores responderam</span>
          {average !== null && <span>Média: {average}%</span>}
        </p>
        {exam.submissions.length ? <div className="report-table-wrap"><table className="report-table">
          <thead><tr><th>Colaborador</th><th>Situação</th><th>Entregue em</th><th>Acertos</th><th>Nota</th><th /></tr></thead>
          <tbody>{exam.submissions.map((submission) => {
            const key = `${exam.id}-${submission.id}`;
            return <tr key={key}>
                <td>{submission.user_name}</td>
                <td><span className={`status-pill ${{ enviada: 'status-concluido', encerrada: 'status-encerrada' }[submission.status] || 'status-em-andamento'}`}>{submissionLabel(submission)}</span></td>
                <td>{formatDateTime(submission.submitted_at)}</td>
                <td>{isFinished(submission) && submission.objective_total ? `${submission.objective_correct} de ${submission.objective_total}` : '—'}</td>
                <td>{isFinished(submission) ? scoreText(submission) : '—'}</td>
                <td>{isFinished(submission) && <button type="button" className="secondary-button" onClick={() => setOpenSubmission(openSubmission === key ? null : key)}>{openSubmission === key ? 'Ocultar respostas' : 'Ver respostas'}</button>}</td>
              </tr>;
          })}</tbody>
        </table></div> : <p className="empty-state">Nenhum colaborador respondeu ainda.</p>}
        {shownSubmission && <div className="exam-answers-panel">
          <h3>Respostas de {shownSubmission.user_name}</h3>
          <AnswerList exam={exam} submission={shownSubmission} />
        </div>}
      </div>;
    })}
  </>;
}
