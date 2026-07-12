import { BookOpen, LogOut, Shield, UserRound } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <BookOpen size={24} />
          <span>Manual Operacional Digital</span>
        </Link>

        <nav className="nav">
          {user && <Link to="/sistemas">Sistemas</Link>}
          {user?.role === 'gerente' && (
            <Link to="/admin">
              <Shield size={16} />
              Admin
            </Link>
          )}
          {user ? (
            <button className="icon-text-button" type="button" onClick={handleLogout}>
              <LogOut size={16} />
              Sair
            </button>
          ) : (
            <Link to="/login">
              <UserRound size={16} />
              Entrar
            </Link>
          )}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
