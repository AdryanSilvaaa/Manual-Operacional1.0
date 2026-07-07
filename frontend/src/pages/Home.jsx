import { ArrowRight, ClipboardCheck, FileVideo, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section className="home">
      <div className="home-content">
        <p className="eyebrow">Base operacional centralizada</p>
        <h1>Manual Operacional Digital</h1>
        <p>
          Acesse tutoriais, PDFs e videos de rotinas internas em um ambiente
          controlado por permissao de usuario.
        </p>
        <Link to="/manuais" className="primary-button">
          Ver Manuais
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
          <span>PDF e video em um unico lugar</span>
        </div>
        <div>
          <LockKeyhole size={24} />
          <span>Acesso por perfil</span>
        </div>
      </div>
    </section>
  );
}
