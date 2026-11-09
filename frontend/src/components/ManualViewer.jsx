/**
 * Busca e exibe o PDF e/ou o vídeo de um manual pelo ID da URL (o manual pode ter só um dos dois).
 * Altere os players aqui; dimensões do PDF/vídeo ficam em styles/pages.css.
 * Prova do manual (exam_id): liberada ao concluir 100% do conteúdo. Obrigatória abre um aviso que só sai iniciando a prova;
 * não obrigatória abre um aviso com "Fazer depois" e fica disponível no menu Provas.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileCheck2, PlaySquare } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import BackButton from './BackButton.jsx';
import PdfReader from './PdfReader.jsx';

function resolveUrl(apiUrl, url) {
  if (!url) {
    return '';
  }

  return url.startsWith('http') ? url : `${apiUrl}${url}`;
}

export default function ManualViewer() {
  const { id } = useParams();
  const { apiUrl, token, user } = useAuth();
  const navigate = useNavigate();
  const [manual, setManual] = useState(null);
  const [examDeferred, setExamDeferred] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ pdf_completed: false, video_progress: 0 });
  const lastVideoProgress = useRef(0);
  const watchedVideoSeconds = useRef(0);
  const lastVideoTime = useRef(null);

  const saveProgress = useCallback(async (changes = {}) => {
    const response = await fetch(`${apiUrl}/api/progress/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(changes)
    });
    if (response.ok) {
      const data = await response.json();
      setProgress(data);
      lastVideoProgress.current = Number(data.video_progress) || 0;
    }
  }, [apiUrl, id, token]);

  useEffect(() => {
    async function loadManual() {
      const response = await fetch(`${apiUrl}/api/manuals/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Manual nao encontrado');
        return;
      }

      setManual(data);
      // O PUT registra o acesso e já devolve o progresso atual, sem precisar de um GET separado.
      await saveProgress();
    }

    loadManual();
  }, [apiUrl, id, token, saveProgress]);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') saveProgress({ seconds: 30 });
    }, 30000);
    return () => window.clearInterval(heartbeat);
  }, [saveProgress]);

  function trackVideo(event) {
    const video = event.currentTarget;
    if (!video.duration) return;
    if (lastVideoTime.current === null) {
      lastVideoTime.current = video.currentTime;
      return;
    }
    const elapsed = video.currentTime - lastVideoTime.current;
    lastVideoTime.current = video.currentTime;
    if (elapsed > 0 && elapsed <= 2) watchedVideoSeconds.current += elapsed;
    const percentage = Math.min(100, (watchedVideoSeconds.current / video.duration) * 100);
    if (percentage >= lastVideoProgress.current + 5 || percentage >= 90) {
      lastVideoProgress.current = percentage;
      saveProgress({ videoProgress: percentage });
    }
  }

  const handlePageViewed = useCallback((page, pageCount) => {
    saveProgress({ page, pageCount, pdfCompleted: pageCount > 0 && page === pageCount });
  }, [saveProgress]);

  if (error) {
    return <section className="page-section"><p className="alert">{error}</p></section>;
  }

  if (!manual) {
    return <div className="center-screen">Carregando manual...</div>;
  }

  // Só o colaborador faz provas; exam_status preenchido = já fez (ou já começou) a prova.
  const hasExam = Boolean(manual.exam_id) && user?.role === ROLES.USER;
  const examPending = hasExam && manual.exam_open && !manual.exam_status;
  const examUnlocked = examPending && Boolean(progress.completed_at);
  const examLabel = manual.exam_required ? 'Prova obrigatória' : 'Prova não obrigatória';
  const showExamModal = examUnlocked && (manual.exam_required || !examDeferred);
  const startExam = () => navigate(`/provas/${manual.exam_id}`);

  return (
    <section className="viewer-page">
      <BackButton fallback="/sistemas" />

      <div className="viewer-header">
        <div>
          <p className="eyebrow">Manual</p>
          <h1>{manual.titulo}</h1>
          {manual.descricao && <p>{manual.descricao}</p>}
        </div>
      </div>

      {manual.pdf_url && <>
        <PdfReader url={resolveUrl(apiUrl, manual.pdf_url)} initialPage={progress.last_page || 1} onPageViewed={handlePageViewed} />

        <div className="manual-progress-panel">
          <div><FileCheck2 size={20} /><span>Leitura do PDF</span><strong>{progress.pdf_completed ? 'Concluída' : 'Pendente'}</strong></div>
          {!progress.pdf_completed && <span className="hint">Visite todas as páginas para concluir a leitura ({progress.pages_viewed?.length || 0}/{progress.page_count || '…'}).</span>}
        </div>
      </>}

      {manual.video_url && <div className="video-block">
        <div className="section-title">
          <PlaySquare size={20} />
          <h2>Video do procedimento</h2>
        </div>
        <video
          controls
          src={resolveUrl(apiUrl, manual.video_url)}
          onLoadedMetadata={(event) => { watchedVideoSeconds.current = (lastVideoProgress.current / 100) * event.currentTarget.duration; }}
          onSeeking={() => { lastVideoTime.current = null; }}
          onTimeUpdate={trackVideo}
        />
        <div className="video-progress"><span>Progresso do vídeo</span><div><i style={{ width: `${Math.min(100, Number(progress.video_progress) || 0)}%` }} /></div><strong>{Math.round(Number(progress.video_progress) || 0)}%</strong></div>
      </div>}
      {progress.completed_at && <p className="manual-complete"><CheckCircle2 size={20} /> Manual concluído</p>}

      {manual.exam_id && !hasExam && <div className="manual-exam-panel">
        <div><ClipboardCheck size={20} /><span>{examLabel}</span><strong>Somente colaboradores</strong></div>
        <span className="hint">Este manual tem prova. Ela é liberada ao colaborador (perfil usuário) quando ele conclui 100% do conteúdo; seu perfil não faz provas.</span>
      </div>}

      {hasExam && <div className="manual-exam-panel">
        <div><ClipboardCheck size={20} /><span>{examLabel}</span><strong>{manual.exam_status ? 'Realizada' : examUnlocked ? 'Liberada' : manual.exam_open ? 'Bloqueada' : 'Indisponível'}</strong></div>
        {examPending && !examUnlocked && <span className="hint">A prova é liberada quando você concluir 100% do conteúdo deste manual.</span>}
        {examUnlocked && <button type="button" className="primary-button" onClick={startExam}><ClipboardCheck size={18} /> Fazer a prova</button>}
        {hasExam && !manual.exam_status && !manual.exam_open && <span className="hint">A prova deste manual foi desativada.</span>}
      </div>}

      {showExamModal && <div className="modal-backdrop" role="presentation">
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="prova-manual-titulo">
          <div className="manual-logo"><ClipboardCheck size={28} /></div>
          <h2 id="prova-manual-titulo">{manual.exam_required ? 'Você concluiu o conteúdo. Agora faça a prova obrigatória.' : 'Você concluiu o conteúdo. Deseja fazer a prova agora?'}</h2>
          <p>{manual.exam_required
            ? 'Esta prova é obrigatória e precisa ser feita agora para concluir o treinamento.'
            : 'Se preferir, faça depois pelo menu Provas.'}</p>
          <div className="modal-actions">
            {!manual.exam_required && <button type="button" className="secondary-button" onClick={() => setExamDeferred(true)}>Fazer depois</button>}
            <button type="button" className="primary-button" onClick={startExam}>{manual.exam_required ? 'Iniciar prova' : 'Fazer agora'}</button>
          </div>
        </div>
      </div>}
    </section>
  );
}
