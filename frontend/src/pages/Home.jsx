/** Página pública inicial; nome e textos da marca vêm de constants/brand.js e o layout de styles/pages.css. */
import { ArrowRight, ClipboardCheck, FileVideo, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PRODUCT_DESCRIPTION, PRODUCT_NAME, PRODUCT_SLOGAN, PRODUCT_TAGLINE } from '../constants/brand.js';

export default function Home() {
  return (
    <section className="home">
      <div className="home-content">
        <p className="eyebrow">{PRODUCT_TAGLINE}</p>
        <h1>{PRODUCT_NAME}</h1>
        <p className="home-slogan">{PRODUCT_SLOGAN}</p>
        <p>{PRODUCT_DESCRIPTION}</p>
        <Link to="/sistemas" className="primary-button">
          Ver Sistemas
          <ArrowRight size={18} />
        </Link>
      </div>

      <div className="home-panel">
        <div>
          <ClipboardCheck size={24} />
          <span>Rotinas padronizadas</span>
        </div>
        <div>
          <FileVideo size={24} />
          <span>PDF e vídeo em um único lugar</span>
        </div>
        <div>
          <LockKeyhole size={24} />
          <span>Acesso por perfil</span>
        </div>
      </div>
    </section>
  );
}
