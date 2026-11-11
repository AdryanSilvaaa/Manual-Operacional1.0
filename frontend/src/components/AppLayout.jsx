/**
 * Estrutura das páginas privadas: sidebar, cabeçalho, perfil e área do Outlet.
 * Altere links aqui para mudar a navegação; aparência correspondente fica em styles/layout.css.
 */
import { BarChart3, ChevronDown, ClipboardCheck, IdCard, KeyRound, LogOut, MonitorCog, Settings, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { can, CONFIG_PERMISSIONS, PERMISSIONS as P } from '../constants/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import AvisoProva from './AvisoProva.jsx';
import BrandLogo from './BrandLogo.jsx';
import PerfilUsuario from './PerfilUsuario.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="app-shell">
      {user && <aside className="sidebar">
        <Link to="/" className="brand"><BrandLogo light /></Link>
        <nav className="sidebar-nav">
          <Link to="/sistemas" title="Sistemas"><MonitorCog size={18} /><span>Sistemas</span></Link>
          {can(user, P.TAKE_EXAMS) && <Link to="/provas" title="Provas"><ClipboardCheck size={18} /><span>Provas</span></Link>}
          {can(user, P.VIEW_REPORTS) && <Link to="/configuracoes/painel-uso" title="Painel de uso"><BarChart3 size={18} /><span>Painel de uso</span></Link>}
          {/* Mesma regra da rota /configuracoes: antes faltavam Unidades e Painel, e o gestor de área não via o menu. */}
          {CONFIG_PERMISSIONS.some((permission) => can(user, permission)) && (
            <Link to="/configuracoes" title="Configurações"><Settings size={18} /><span>Configurações</span></Link>
          )}
        </nav>
      </aside>}
      <div className="app-content">
        <header className="topbar">
          {!user && <Link to="/" className="brand"><BrandLogo /></Link>}
          <div className="topbar-spacer" />
          <nav className="nav">
          {user ? (
            <div className="profile-menu">
              <button className="icon-text-button" type="button" onClick={() => setProfileOpen(!profileOpen)}>
                <UserRound size={16} /> {user.nome} <ChevronDown size={15} />
              </button>
              {profileOpen && <div className="profile-dropdown">
                <button type="button" onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}><IdCard size={16} /> Meu perfil</button>
                <Link to="/alterar-senha" onClick={() => setProfileOpen(false)}><KeyRound size={16} /> Alterar senha</Link>
                <button type="button" onClick={handleLogout}><LogOut size={16} /> Sair</button>
              </div>}
            </div>
          ) : (
            <Link to="/login">
              <UserRound size={16} />
              Entrar
            </Link>
          )}
          </nav>
        </header>

        <main><Outlet /></main>
        {/* Com senha provisória a API bloqueia tudo até a troca, então o aviso de prova não é consultado. */}
        {user && !user.must_change_password && <AvisoProva />}
        {user && profileModalOpen && <PerfilUsuario onClose={() => setProfileModalOpen(false)} />}
      </div>
    </div>
  );
}
