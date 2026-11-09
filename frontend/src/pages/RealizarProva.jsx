/**
 * Tela em que o colaborador responde a prova; cada colaborador faz a prova uma única vez.
 * Depois de iniciar, sair da página (navegar no sistema, voltar, recarregar ou fechar) ou trocar de aba,
 * de janela ou minimizar encerra a prova com as respostas marcadas até ali. A regra também vale no backend: quem volta para uma prova em andamento
 * a encontra encerrada.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, Send } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { OPTION_LETTERS, QUESTION_TYPES, formatDateTime } from '../constants/exam.js';
import BackButton from '../components/BackButton.jsx';

const LEAVE_WARNING = 'Se você sair desta página agora, a prova será encerrada com as respostas marcadas até aqui e não poderá ser refeita. Sair mesmo assim?';
// Janelas de confirmação do navegador tiram o foco da página; durante elas a perda de foco não encerra a prova.
const DIALOG_GRACE_MS = 800;

export default function RealizarProva() {
  const { id } = useParams();
  const { apiUrl, token } = useAuth();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [closed, setClosed] = useState(false);
  // Respostas atuais e se a prova já terminou, lidas na saída da página (fora do ciclo de renderização).
  const answersRef = useRef(answers);
  const finishedRef = useRef(false);
  const ignoreBlurRef = useRef(false);
  answersRef.current = answers;
  const inProgress = Boolean(questions) && !sent && !closed;

  // window.confirm sem encerrar a prova pela perda de foco que a própria janela de confirmação causa.
  function confirmInPage(message) {
    ignoreBlurRef.current = true;
    try {
      return window.confirm(message);
    } finally {
      setTimeout(() => { ignoreBlurRef.current = false; }, DIALOG_GRACE_MS);
    }
  }

  useEffect(() => {
    fetch(`${apiUrl}/api/exams/${id}`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setExam).catch((requestError) => toast.error(requestError.message));
  }, [apiUrl, id, token, toast]);

  // Enquanto a prova está em andamento, qualquer saída da página encerra a prova no servidor.
  useEffect(() => {
    if (!inProgress) return undefined;
    // keepalive deixa o pedido terminar mesmo com a aba sendo fechada ou recarregada.
    const closeExam = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      fetch(`${apiUrl}/api/exams/${id}/leave`, {
        method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify({ answers: answersRef.current }), keepalive: true
      }).catch(() => {});
    };
    // Trocar de aba, de janela ou minimizar: encerra na hora e mostra o aviso na própria tela.
    const closeOnSwitch = () => {
      if (finishedRef.current) return;
      closeExam();
      setClosed(true);
    };
    const handleBlur = () => { if (!ignoreBlurRef.current) closeOnSwitch(); };
    const handleVisibility = () => { if (document.visibilityState === 'hidden') closeOnSwitch(); };
    // Fechar ou recarregar: o navegador mostra o próprio aviso de saída.
    const warnBeforeUnload = (event) => {
      ignoreBlurRef.current = true;
      setTimeout(() => { ignoreBlurRef.current = false; }, DIALOG_GRACE_MS);
      event.preventDefault();
      event.returnValue = '';
    };
    // Links do sistema (menu, logo, perfil): confirma antes; cancelando, a pessoa continua na prova.
    const confirmLinkClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || confirmInPage(LEAVE_WARNING)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    window.addEventListener('pagehide', closeExam);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('click', confirmLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      window.removeEventListener('pagehide', closeExam);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('click', confirmLinkClick, true);
      // Saída por navegação dentro do sistema (link confirmado, botão voltar do navegador, sair da conta).
      closeExam();
    };
  }, [apiUrl, id, inProgress, token]);

  async function handleStart() {
    setStarting(true);
    try {
      const response = await fetch(`${apiUrl}/api/exams/${id}/start`, { method: 'POST', headers: createAuthHeaders(token) });
      const started = await readResponse(response);
      setQuestions(started.questions);
    } catch (requestError) {
      toast.error(requestError.message);
      setExam(null);
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!confirmInPage('Depois de enviar não é possível alterar as respostas. Enviar a prova?')) return;
    setSending(true);
    try {
      const response = await fetch(`${apiUrl}/api/exams/${id}/submissions`, { method: 'POST', headers: createAuthHeaders(token), body: JSON.stringify({ answers }) });
      await readResponse(response);
      finishedRef.current = true;
      setSent(true);
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setSending(false);
    }
  }

  if (closed) {
    return <section className="page-section"><BackButton fallback="/provas" /><p className="alert">Prova encerrada porque você saiu da página ou trocou de aba ou de janela. As respostas marcadas até ali foram registradas.</p></section>;
  }

  if (sent) {
    return <section className="page-section"><BackButton fallback="/sistemas" /><p className="manual-complete"><CheckCircle2 size={20} /> Prova enviada. Obrigado!</p></section>;
  }

  const heading = <div className="page-heading"><p className="eyebrow">Prova</p><h1>{exam?.titulo || 'Prova'}</h1>{exam && <p>{exam.descricao ? `${exam.descricao} · ` : ''}{exam.ends_at ? `Disponível até ${formatDateTime(exam.ends_at)}` : 'Sem prazo final'}{exam.required ? ' · Prova obrigatória' : ''}</p>}</div>;

  // Sem botão Voltar durante a prova: a saída é pelo envio.
  if (inProgress) {
    return <section className="admin-page">
      {heading}
      <p className="exam-lock-banner"><AlertTriangle size={18} /> Prova em andamento. Não saia desta página nem troque de aba ou de janela até enviar: isso encerra a prova.</p>
      <form className="admin-panel manual-form quiz-form" onSubmit={handleSubmit}>
        {questions.map((question, index) => <fieldset key={question.id}>
          <legend>Pergunta {index + 1}</legend>
          <p className="exam-prompt">{question.prompt}</p>
          {question.type === QUESTION_TYPES.OPEN
            ? <textarea aria-label={`Resposta da pergunta ${index + 1}`} value={answers[question.id] || ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} required />
            : question.options.map((option, optionIndex) => <label className="quiz-option" key={optionIndex}>
              <input type="radio" name={`question-${question.id}`} checked={answers[question.id] === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} required />
              <span><strong>{OPTION_LETTERS[optionIndex]})</strong> {option}</span>
            </label>)}
        </fieldset>)}
        <button className="primary-button" disabled={sending}><Send size={18} />{sending ? 'Enviando...' : 'Enviar prova'}</button>
      </form>
    </section>;
  }

  return <section className="admin-page">
    <BackButton fallback="/provas" />
    {heading}
    {exam && <div className="admin-panel manual-form exam-start">
      <h2>Antes de começar</h2>
      <ul>
        <li>A prova tem {exam.question_count} {exam.question_count === 1 ? 'pergunta' : 'perguntas'} e pode ser feita uma vez só.</li>
        <li>Depois de iniciar, <strong>não saia desta página</strong> até enviar. Navegar para outra tela do sistema, voltar, recarregar, fechar a página, <strong>trocar de aba ou de janela, ou minimizar o navegador</strong> encerra a prova com as respostas marcadas até ali.</li>
        <li>As perguntas sem resposta contam como erradas.</li>
      </ul>
      <button type="button" className="primary-button" onClick={handleStart} disabled={starting}><Play size={18} />{starting ? 'Iniciando...' : 'Iniciar prova'}</button>
    </div>}
  </section>;
}
