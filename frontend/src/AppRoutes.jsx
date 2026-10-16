/**
 * Mapa central de URLs, layouts e perfis autorizados do frontend.
 * Alterar path muda o endereço da tela; alterar roles muda quem consegue abri-la.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import Login from './components/Login.jsx';
import ManualViewer from './components/ManualViewer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { ADMIN_ROLES, FULL_ADMIN_ROLES, ROLES } from './constants/roles.js';
import Admin from './pages/Admin.jsx';
import CadastroSistemas from './pages/CadastroSistemas.jsx';
import CriarManual from './pages/CriarManual.jsx';
import CriarProva from './pages/CriarProva.jsx';
import Home from './pages/Home.jsx';
import Manuais from './pages/Manuais.jsx';
import Setores from './pages/Setores.jsx';
import Sistemas from './pages/Sistemas.jsx';
import Usuarios from './pages/Usuarios.jsx';
import PainelUso from './pages/PainelUso.jsx';
import AlterarSenha from './pages/AlterarSenha.jsx';
import Provas from './pages/Provas.jsx';
import RealizarProva from './pages/RealizarProva.jsx';

function PrivatePage({ children, roles }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
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
