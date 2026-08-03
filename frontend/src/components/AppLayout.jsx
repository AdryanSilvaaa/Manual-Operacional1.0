/**
 * Estrutura das páginas privadas: sidebar, cabeçalho, perfil e área do Outlet.
 * Altere links aqui para mudar a navegação; aparência correspondente fica em styles/layout.css.
 */
import { ChevronDown, LogOut, MonitorCog, Settings, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ADMIN_ROLES } from '../constants/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from './BrandLogo.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

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
          {ADMIN_ROLES.includes(user.role) && (
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
                {ADMIN_ROLES.includes(user.role) && <Link to="/configuracoes" onClick={() => setProfileOpen(false)}><Settings size={16} /> Configurações</Link>}
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
      </div>
    </div>
  );
}
