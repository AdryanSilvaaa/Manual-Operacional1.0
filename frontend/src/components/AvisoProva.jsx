/**
 * Pop-up exibido ao colaborador quando há prova disponível em um dos seus setores.
 * "Fazer mais tarde" esconde o aviso até o próximo login; a prova continua no menu Provas.
 * Prova obrigatória de manual (já liberada por ter concluído o manual) não tem "Fazer mais tarde" e bloqueia o sistema:
 * a lista é consultada de novo a cada troca de página (inclusive pelo botão Voltar do navegador), então o aviso
 * volta em qualquer tela até a prova ser feita.
 * Na tela do próprio manual o aviso não aparece, porque o visualizador já mostra o dele.
 */
import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';

const DISMISSED_KEY = 'provas-adiadas';

function readDismissed() {
  try { return JSON.parse(sessionStorage.getItem(DISMISSED_KEY)) || []; } catch { return []; }
}

export default function AvisoProva() {
  const { apiUrl, token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [exam, setExam] = useState(null);
  const isCollaborator = user?.role === ROLES.USER;
  const takingExam = location.pathname.startsWith('/provas/');
  const { pathname } = location;

  useEffect(() => {
    if (!isCollaborator || takingExam) return undefined;
    let active = true;
    fetch(`${apiUrl}/api/exams/available`, { headers: createAuthHeaders(token) })
      .then(readResponse)
      .then((exams) => {
        const dismissed = readDismissed();
        // Obrigatória não pode ser adiada; ela vem primeiro na lista do backend.
        if (active) setExam(exams.find((item) => item.required || !dismissed.includes(item.id)) || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [apiUrl, token, isCollaborator, takingExam, pathname]);

  const onOwnManual = Boolean(exam?.manual_id) && location.pathname === `/manuais/${exam.manual_id}`;
  if (!exam || takingExam || onOwnManual) return null;

  function later() {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), exam.id]));
    setExam(null);
  }

  function start() {
    setExam(null);
    navigate(`/provas/${exam.id}`);
  }

  return <div className="modal-backdrop" role="presentation">
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="aviso-prova-titulo">
      <div className="manual-logo"><ClipboardCheck size={28} /></div>
      <h2 id="aviso-prova-titulo">{exam.required ? 'Você tem uma prova obrigatória pendente.' : 'Você tem uma prova disponível. Deseja realizar agora?'}</h2>
      <p>{exam.titulo}{exam.manual_titulo ? ` (manual ${exam.manual_titulo})` : ''}</p>
      <div className="modal-actions">
        {!exam.required && <button type="button" className="secondary-button" onClick={later}>Fazer mais tarde</button>}
        <button type="button" className="primary-button" onClick={start}>{exam.required ? 'Iniciar prova' : 'Sim'}</button>
      </div>
    </div>
  </div>;
}
