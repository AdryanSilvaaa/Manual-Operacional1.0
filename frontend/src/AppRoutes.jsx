/**
 * Mapa central de URLs, layouts e perfis autorizados do frontend.
 * Alterar path muda o endereço da tela; alterar roles muda quem consegue abri-la.
 */
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import Login from './components/Login.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { ADMIN_ROLES, FULL_ADMIN_ROLES, ROLES } from './constants/roles.js';
import Home from './pages/Home.jsx';

// Cada tela vira um arquivo separado, baixado só quando aberta. O leitor de PDF (pdf.js) e as telas
// administrativas deixam de pesar no primeiro carregamento de quem só faz login e lê manuais.
const ManualViewer = lazy(() => import('./components/ManualViewer.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const CadastroSistemas = lazy(() => import('./pages/CadastroSistemas.jsx'));
const CriarManual = lazy(() => import('./pages/CriarManual.jsx'));
const CriarProva = lazy(() => import('./pages/CriarProva.jsx'));
const Manuais = lazy(() => import('./pages/Manuais.jsx'));
const Setores = lazy(() => import('./pages/Setores.jsx'));
const Sistemas = lazy(() => import('./pages/Sistemas.jsx'));
const Usuarios = lazy(() => import('./pages/Usuarios.jsx'));
const PainelUso = lazy(() => import('./pages/PainelUso.jsx'));
const AlterarSenha = lazy(() => import('./pages/AlterarSenha.jsx'));
const Provas = lazy(() => import('./pages/Provas.jsx'));
const RealizarProva = lazy(() => import('./pages/RealizarProva.jsx'));

function PrivatePage({ children, roles }) {
  return <ProtectedRoute roles={roles}>
    <Suspense fallback={<p className="empty-state">Carregando...</p>}>{children}</Suspense>
  </ProtectedRoute>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="sistemas" element={<PrivatePage><Sistemas /></PrivatePage>} />
        <Route path="sistemas/:systemId/manuais" element={<PrivatePage><Manuais /></PrivatePage>} />
        <Route path="manuais/:id" element={<PrivatePage><ManualViewer /></PrivatePage>} />
        <Route path="configuracoes" element={<PrivatePage roles={ADMIN_ROLES}><Admin /></PrivatePage>} />
        <Route path="configuracoes/usuarios" element={<PrivatePage roles={FULL_ADMIN_ROLES}><Usuarios /></PrivatePage>} />
        <Route path="configuracoes/sistemas" element={<PrivatePage roles={FULL_ADMIN_ROLES}><CadastroSistemas /></PrivatePage>} />
        <Route path="configuracoes/setores" element={<PrivatePage roles={FULL_ADMIN_ROLES}><Setores /></PrivatePage>} />
        <Route path="configuracoes/manuais" element={<PrivatePage roles={ADMIN_ROLES}><CriarManual /></PrivatePage>} />
        <Route path="configuracoes/provas" element={<PrivatePage roles={ADMIN_ROLES}><CriarProva /></PrivatePage>} />
        <Route path="provas" element={<PrivatePage roles={[ROLES.USER]}><Provas /></PrivatePage>} />
        <Route path="provas/:id" element={<PrivatePage roles={[ROLES.USER]}><RealizarProva /></PrivatePage>} />
        <Route path="configuracoes/painel-uso" element={<PrivatePage roles={ADMIN_ROLES}><PainelUso /></PrivatePage>} />
        <Route path="alterar-senha" element={<PrivatePage><AlterarSenha /></PrivatePage>} />
        <Route path="admin" element={<Navigate to="/configuracoes" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
