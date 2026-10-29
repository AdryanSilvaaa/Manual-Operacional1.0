/**
 * Leitor de PDF paginado (PDF.js) com zoom e navegação no topo e no fim da página.
 * Cada página exibida é informada em onPageViewed, que alimenta o progresso do manual.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Zoom relativo à largura da tela: 1 = página inteira na largura disponível.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export default function PdfReader({ url, initialPage = 1, onPageViewed }) {
  const readerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [page, setPage] = useState(initialPage || 1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    pdfjs.getDocument(url).promise.then((loaded) => {
      if (!active) return;
      setDocument(loaded);
      setPage(Math.min(Math.max(initialPage || 1, 1), loaded.numPages));
    }).catch(() => setError('Não foi possível carregar o PDF.')).finally(() => setLoading(false));
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    if (!document || !canvasRef.current) return;
    let cancelled = false;
    document.getPage(page).then(async (pdfPage) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const availableWidth = Math.min(canvas.parentElement.clientWidth - 32, 1100);
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: (availableWidth / baseViewport.width) * zoom });
      // Desenha na resolução da tela (retina) para o texto continuar nítido com zoom.
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      // Cliques rápidos no zoom ou na página cancelam o desenho anterior no mesmo canvas.
      renderTaskRef.current?.cancel();
      const task = pdfPage.render({
        canvasContext: canvas.getContext('2d'), viewport, transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]
      });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (renderError) {
        if (renderError?.name === 'RenderingCancelledException') return;
        throw renderError;
      }
      if (!cancelled) onPageViewed?.(page, document.numPages);
    });
    return () => { cancelled = true; };
  }, [document, onPageViewed, page, zoom]);

  // A navegação do fim da página volta ao topo do documento para começar a leitura da próxima.
  function goTo(nextPage, scrollToTop = false) {
    setPage(Math.min(Math.max(nextPage, 1), document.numPages));
    if (scrollToTop) readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const changeZoom = (delta) => setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((value + delta) * 100) / 100)));

  if (loading) return <div className="pdf-reader-state"><LoaderCircle className="spin" /> Carregando PDF...</div>;
  if (error) return <p className="alert">{error}</p>;

  const total = document?.numPages || 0;
  const pageNavigation = (scrollToTop) => <>
    <button type="button" onClick={() => goTo(page - 1, scrollToTop)} disabled={page <= 1}><ChevronLeft /> Anterior</button>
    <strong>Página {page} de {total}</strong>
    <button type="button" onClick={() => goTo(page + 1, scrollToTop)} disabled={page >= total}>Próxima <ChevronRight /></button>
  </>;

  return <div className="pdf-reader" ref={readerRef}>
    <div className="pdf-toolbar">
      <div className="pdf-toolbar-group">{pageNavigation(false)}</div>
      <div className="pdf-toolbar-group pdf-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Diminuir zoom" title="Diminuir zoom"><ZoomOut /></button>
        <button type="button" className="pdf-zoom-value" onClick={() => setZoom(1)} title="Ajustar à largura">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Aumentar zoom" title="Aumentar zoom"><ZoomIn /></button>
      </div>
    </div>
    <div className={`pdf-canvas-wrap${zoom > 1 ? ' pdf-zoomed' : ''}`}><canvas ref={canvasRef} /></div>
    <div className="pdf-toolbar pdf-bottom-nav"><div className="pdf-toolbar-group">{pageNavigation(true)}</div></div>
  </div>;
}
