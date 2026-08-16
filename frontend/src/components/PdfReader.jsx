import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfReader({ url, initialPage = 1, onPageViewed }) {
  const canvasRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [page, setPage] = useState(initialPage || 1);
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
      const viewport = pdfPage.getViewport({ scale: availableWidth / baseViewport.width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      onPageViewed?.(page, document.numPages);
    });
    return () => { cancelled = true; };
  }, [document, onPageViewed, page]);

  if (loading) return <div className="pdf-reader-state"><LoaderCircle className="spin" /> Carregando PDF...</div>;
  if (error) return <p className="alert">{error}</p>;

  return <div className="pdf-reader">
    <div className="pdf-toolbar">
      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}><ChevronLeft /> Anterior</button>
      <strong>Página {page} de {document?.numPages || 0}</strong>
      <button type="button" onClick={() => setPage((value) => Math.min(document.numPages, value + 1))} disabled={page >= document?.numPages}>Próxima <ChevronRight /></button>
    </div>
    <div className="pdf-canvas-wrap"><canvas ref={canvasRef} /></div>
  </div>;
}
