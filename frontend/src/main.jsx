import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Home from './pages/Home.jsx';
import Login from './components/Login.jsx';
import Manuais from './pages/Manuais.jsx';
import Sistemas from './pages/Sistemas.jsx';
import ManualViewer from './components/ManualViewer.jsx';
import Admin from './pages/Admin.jsx';
import Usuarios from './pages/Usuarios.jsx';
import CadastroSistemas from './pages/CadastroSistemas.jsx';
import CriarManual from './pages/CriarManual.jsx';
import Setores from './pages/Setores.jsx';
import './styles.css';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-screen">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/sistemas" replace />;
  }

  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/sistemas"
              element={
                <ProtectedRoute>
                  <Sistemas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sistemas/:systemId/manuais"
              element={
                <ProtectedRoute>
                  <Manuais />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manuais/:id"
              element={
                <ProtectedRoute>
                  <ManualViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute roles={['suporte', 'gerente_setor', 'gerente']}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={<Navigate to="/configuracoes" replace />} />
            <Route path="/configuracoes/usuarios" element={<ProtectedRoute roles={['suporte', 'gerente']}><Usuarios /></ProtectedRoute>} />
            <Route path="/configuracoes/sistemas" element={<ProtectedRoute roles={['suporte', 'gerente']}><CadastroSistemas /></ProtectedRoute>} />
            <Route path="/configuracoes/setores" element={<ProtectedRoute roles={['suporte', 'gerente']}><Setores /></ProtectedRoute>} />
            <Route path="/configuracoes/manuais" element={<ProtectedRoute roles={['suporte', 'gerente_setor', 'gerente']}><CriarManual /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
