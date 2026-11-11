/**
 * Mapa central de URLs, layouts e perfis autorizados do frontend.
 * Alterar path muda o endereço da tela; alterar permissions muda quem consegue abri-la (ver constants/roles.js).
 */
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import Login from './components/Login.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { CONFIG_PERMISSIONS, PERMISSIONS as P } from './constants/roles.js';
import Home from './pages/Home.jsx';

// Cada tela vira um arquivo separado, baixado só quando aberta. O leitor de PDF (pdf.js) e as telas
// administrativas deixam de pesar no primeiro carregamento de quem só faz login e lê manuais.
const ManualViewer = lazy(() => import('./components/ManualViewer.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const CadastroSistemas = lazy(() => import('./pages/CadastroSistemas.jsx'));
const CriarManual = lazy(() => import('./pages/CriarManual.jsx'));
const GerenciarManuais = lazy(() => import('./pages/GerenciarManuais.jsx'));
const ModelosProva = lazy(() => import('./pages/ModelosProva.jsx'));
const Manuais = lazy(() => import('./pages/Manuais.jsx'));
const Setores = lazy(() => import('./pages/Setores.jsx'));
const Unidades = lazy(() => import('./pages/Unidades.jsx'));
const Sistemas = lazy(() => import('./pages/Sistemas.jsx'));
const Usuarios = lazy(() => import('./pages/Usuarios.jsx'));
const PainelUso = lazy(() => import('./pages/PainelUso.jsx'));
const AlterarSenha = lazy(() => import('./pages/AlterarSenha.jsx'));
const Provas = lazy(() => import('./pages/Provas.jsx'));
const RealizarProva = lazy(() => import('./pages/RealizarProva.jsx'));
const Aparencia = lazy(() => import('./pages/Aparencia.jsx'));

function PrivatePage({ children, permissions }) {
  return <ProtectedRoute permissions={permissions}>
    <Suspense fallback={<p className="empty-state">Carregando...</p>}>{children}</Suspense>
  </ProtectedRoute>;
}

// Configurações abre para quem tem pelo menos um dos atalhos dela (lista em constants/roles.js).

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="sistemas" element={<PrivatePage><Sistemas /></PrivatePage>} />
        <Route path="sistemas/:systemId/manuais" element={<PrivatePage><Manuais /></PrivatePage>} />
        <Route path="manuais/:id" element={<PrivatePage><ManualViewer /></PrivatePage>} />
        <Route path="configuracoes" element={<PrivatePage permissions={CONFIG_PERMISSIONS}><Admin /></PrivatePage>} />
        <Route path="configuracoes/usuarios" element={<PrivatePage permissions={[P.MANAGE_USERS]}><Usuarios /></PrivatePage>} />
        <Route path="configuracoes/sistemas" element={<PrivatePage permissions={[P.MANAGE_SYSTEMS]}><CadastroSistemas /></PrivatePage>} />
        <Route path="configuracoes/setores" element={<PrivatePage permissions={[P.MANAGE_SECTORS]}><Setores /></PrivatePage>} />
        <Route path="configuracoes/unidades" element={<PrivatePage permissions={[P.MANAGE_UNITS]}><Unidades /></PrivatePage>} />
        <Route path="configuracoes/aparencia" element={<PrivatePage permissions={[P.MANAGE_BRANDING]}><Aparencia /></PrivatePage>} />
        <Route path="configuracoes/manuais" element={<PrivatePage permissions={[P.PUBLISH_CONTENT]}><CriarManual /></PrivatePage>} />
        <Route path="configuracoes/gerenciar-manuais" element={<PrivatePage permissions={[P.PUBLISH_CONTENT]}><GerenciarManuais /></PrivatePage>} />
        <Route path="configuracoes/modelos-prova" element={<PrivatePage permissions={[P.PUBLISH_CONTENT]}><ModelosProva /></PrivatePage>} />
        <Route path="provas" element={<PrivatePage permissions={[P.TAKE_EXAMS]}><Provas /></PrivatePage>} />
        <Route path="provas/:id" element={<PrivatePage permissions={[P.TAKE_EXAMS]}><RealizarProva /></PrivatePage>} />
        <Route path="configuracoes/painel-uso" element={<PrivatePage permissions={[P.VIEW_REPORTS]}><PainelUso /></PrivatePage>} />
        <Route path="alterar-senha" element={<PrivatePage><AlterarSenha /></PrivatePage>} />
        <Route path="admin" element={<Navigate to="/configuracoes" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
