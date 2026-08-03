/**
 * Barreira de navegação para sessão e perfis autorizados.
 * Alterar a checagem roles muda o acesso de todas as rotas que usam este componente.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="center-screen" role="status">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/sistemas" replace />;
  }

  return children;
}
