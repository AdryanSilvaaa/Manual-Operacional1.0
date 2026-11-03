import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Retorna pelo histórico e usa uma rota interna segura em acessos diretos. */
export default function BackButton({ fallback = '/', label = 'Voltar' }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleBack() {
    if (location.key !== 'default' && window.history.length > 1) navigate(-1);
    else navigate(fallback);
  }

  return <button type="button" className="back-link back-button" onClick={handleBack}><ArrowLeft size={18} />{label}</button>;
}
