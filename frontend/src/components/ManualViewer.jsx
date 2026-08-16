/**
 * Busca e exibe o PDF e o vídeo de um manual pelo ID da URL.
 * Altere os players aqui; dimensões do PDF/vídeo ficam em styles/pages.css.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileCheck2, PlaySquare } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BackButton from './BackButton.jsx';
import PdfReader from './PdfReader.jsx';
import Quiz from './Quiz.jsx';

function resolveUrl(apiUrl, url) {
  if (!url) {
    return '';
  }

  return url.startsWith('http') ? url : `${apiUrl}${url}`;
}

export default function ManualViewer() {
  const { id } = useParams();
  const { apiUrl, token } = useAuth();
  const [manual, setManual] = useState(null);
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
      const progressResponse = await fetch(`${apiUrl}/api/progress/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (progressResponse.ok) {
        const currentProgress = await progressResponse.json();
        setProgress(currentProgress);
        lastVideoProgress.current = Number(currentProgress.video_progress) || 0;
      }
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

      <PdfReader url={resolveUrl(apiUrl, manual.pdf_url)} initialPage={progress.last_page || 1} onPageViewed={handlePageViewed} />

      <div className="manual-progress-panel">
        <div><FileCheck2 size={20} /><span>Leitura do PDF</span><strong>{progress.pdf_completed ? 'Concluída' : 'Pendente'}</strong></div>
        {!progress.pdf_completed && <span className="hint">Visite todas as páginas para concluir a leitura ({progress.pages_viewed?.length || 0}/{progress.page_count || '…'}).</span>}
      </div>

      <div className="video-block">
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
      </div>
      <Quiz apiUrl={apiUrl} token={token} manualId={id} onPassed={() => saveProgress()} />
      {progress.completed_at && <p className="manual-complete"><CheckCircle2 size={20} /> Manual concluído</p>}
    </section>
  );
}
