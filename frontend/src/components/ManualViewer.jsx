/**
 * Busca e exibe o PDF e o vídeo de um manual pelo ID da URL.
 * Altere os players aqui; dimensões do PDF/vídeo ficam em styles/pages.css.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, PlaySquare } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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
    }

    loadManual();
  }, [apiUrl, id, token]);

  if (error) {
    return <section className="page-section"><p className="alert">{error}</p></section>;
  }

  if (!manual) {
    return <div className="center-screen">Carregando manual...</div>;
  }

  return (
    <section className="viewer-page">
      <Link to="/sistemas" className="back-link">
        <ArrowLeft size={18} />
        Voltar
      </Link>

      <div className="viewer-header">
        <div>
          <p className="eyebrow">Manual</p>
          <h1>{manual.titulo}</h1>
          {manual.descricao && <p>{manual.descricao}</p>}
        </div>
      </div>

      <iframe
        className="pdf-viewer"
        title={`PDF - ${manual.titulo}`}
        src={resolveUrl(apiUrl, manual.pdf_url)}
      />

      <div className="video-block">
        <div className="section-title">
          <PlaySquare size={20} />
          <h2>Video do procedimento</h2>
        </div>
        <video controls src={resolveUrl(apiUrl, manual.video_url)} />
      </div>
    </section>
  );
}
