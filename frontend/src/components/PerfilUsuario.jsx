/**
 * Pop-up "Meu perfil" aberto pelo menu do usuário: nome completo, login, perfil e setores.
 * Os dados são relidos de /api/auth/me ao abrir, para mostrar os setores atuais.
 */
import { useEffect, useState } from 'react';
import { Building2, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS } from '../constants/roles.js';
import { createAuthHeaders, readResponse } from '../utils/api.js';

export default function PerfilUsuario({ onClose }) {
  const { apiUrl, token, user } = useAuth();
  const [profile, setProfile] = useState(user);

  useEffect(() => {
    fetch(`${apiUrl}/api/auth/me`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setProfile).catch(() => {});
  }, [apiUrl, token]);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const sectors = profile?.setores || [];

  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <div className="modal-card profile-card" role="dialog" aria-modal="true" aria-labelledby="perfil-titulo" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      <div className="manual-logo"><UserRound size={28} /></div>
      <h2 id="perfil-titulo">Meu perfil</h2>
      <dl className="profile-details">
        <dt>Nome completo</dt><dd>{profile?.nome}</dd>
        <dt>Usuário</dt><dd>{profile?.identificador || '—'}</dd>
        <dt>Perfil</dt><dd>{ROLE_LABELS[profile?.role] || profile?.role}</dd>
        <dt>Setores</dt>
        <dd>{sectors.length
          ? <ul className="sector-chips">{sectors.map((sector) => <li key={sector.id}><Building2 size={14} />{sector.nome}</li>)}</ul>
          : 'Nenhum setor vinculado'}</dd>
      </dl>
    </div>
  </div>;
}
