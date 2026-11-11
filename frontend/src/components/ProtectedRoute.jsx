/**
 * Barreira de navegação para sessão e perfis autorizados.
 * permissions: a pessoa precisa de pelo menos uma delas (constants/roles.js). Sem permissions basta estar logado.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { can } from '../constants/roles.js';

export default function ProtectedRoute({ children, permissions }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="center-screen" role="status">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Senha provisória (definida por outra pessoa): só a tela de troca de senha fica liberada.
  if (user.must_change_password && location.pathname !== '/alterar-senha') {
    return <Navigate to="/alterar-senha" replace />;
  }

  if (permissions && !permissions.some((permission) => can(user, permission))) {
    return <Navigate to="/sistemas" replace />;
  }

  return children;
}
