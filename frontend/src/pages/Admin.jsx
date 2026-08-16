/** Painel de atalhos administrativos; links e perfis visíveis são definidos nesta tela. */
import { BarChart3, BookOpenCheck, Boxes, Building2, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FULL_ADMIN_ROLES } from '../constants/roles.js';
import BackButton from '../components/BackButton.jsx';

// Exibe somente as configuracoes que o perfil atual pode administrar.
export default function Admin() {
  const { user } = useAuth();
  const isSupport = FULL_ADMIN_ROLES.includes(user.role);
  const items = [
    ...(isSupport ? [
      { to: '/configuracoes/usuarios', icon: UsersRound, title: 'Criar / Alterar Usuários', text: 'Cadastre usuários, perfis e setores.' },
      { to: '/configuracoes/setores', icon: Building2, title: 'Cadastrar Setor', text: 'Mantenha os setores disponíveis para a operação.' },
      { to: '/configuracoes/sistemas', icon: Boxes, title: 'Cadastrar Sistemas', text: 'Gerencie os sistemas disponíveis para todos os setores.' }
    ] : []),
    { to: '/configuracoes/manuais', icon: BookOpenCheck, title: 'Criar Manual', text: 'Envie materiais e vincule-os a um setor.' },
    { to: '/configuracoes/painel-uso', icon: BarChart3, title: 'Painel de Uso', text: 'Acompanhe leituras e conclusões por manual e operador.' }
  ];
  return <section className="page-section"><BackButton fallback="/sistemas" /><div className="page-heading"><p className="eyebrow">Perfil</p><h1>Configurações</h1></div><div className="manual-grid">{items.map(({ to, icon: Icon, title, text }) => <Link key={to} to={to} className="manual-card"><div className="manual-logo"><Icon size={28} /></div><div><h2>{title}</h2><p>{text}</p></div></Link>)}</div></section>;
}
