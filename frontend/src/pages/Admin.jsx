/** Painel de atalhos administrativos; cada atalho depende de uma permissão do perfil. */
import { BarChart3, BookOpenCheck, Boxes, Building2, ClipboardList, FilePenLine, MapPin, Palette, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { can, PERMISSIONS as P } from '../constants/roles.js';
import BackButton from '../components/BackButton.jsx';

// Cada atalho aparece só para quem tem a permissão dele (constants/roles.js).
const ITEMS = [
  { permission: P.MANAGE_USERS, to: '/configuracoes/usuarios', icon: UsersRound, title: 'Criar / Alterar Usuários', text: 'Cadastre usuários, perfis, setores e unidades.' },
  { permission: P.MANAGE_SECTORS, to: '/configuracoes/setores', icon: Building2, title: 'Cadastrar Setor', text: 'Mantenha os setores disponíveis para a operação.' },
  { permission: P.MANAGE_UNITS, to: '/configuracoes/unidades', icon: MapPin, title: 'Unidades', text: 'Cadastre as unidades (filiais) da empresa.' },
  { permission: P.MANAGE_SYSTEMS, to: '/configuracoes/sistemas', icon: Boxes, title: 'Cadastrar Sistemas', text: 'Gerencie os sistemas disponíveis para todos os setores.' },
  { permission: P.MANAGE_BRANDING, to: '/configuracoes/aparencia', icon: Palette, title: 'Aparência', text: 'Troque as cores e as logos da plataforma.' },
  { permission: P.PUBLISH_CONTENT, to: '/configuracoes/manuais', icon: BookOpenCheck, title: 'Criar Manual', text: 'Envie materiais e vincule-os a um setor.' },
  { permission: P.PUBLISH_CONTENT, to: '/configuracoes/gerenciar-manuais', icon: FilePenLine, title: 'Gerenciar Manuais', text: 'Edite, desative ou exclua manuais já publicados.' },
  { permission: P.PUBLISH_CONTENT, to: '/configuracoes/modelos-prova', icon: ClipboardList, title: 'Modelos de Prova', text: 'Monte provas de até 10 perguntas, guarde e aplique a colaboradores específicos ou ao setor.' },
  { permission: P.VIEW_REPORTS, to: '/configuracoes/painel-uso', icon: BarChart3, title: 'Painel de Uso', text: 'Acompanhe leituras, conclusões e resultados de provas.' }
];

export default function Admin() {
  const { user } = useAuth();
  const items = ITEMS.filter((item) => can(user, item.permission));
  return <section className="page-section"><BackButton fallback="/sistemas" /><div className="page-heading"><p className="eyebrow">Perfil</p><h1>Configurações</h1></div><div className="manual-grid">{items.map(({ to, icon: Icon, title, text }) => <Link key={to} to={to} className="manual-card"><div className="manual-logo"><Icon size={28} /></div><div><h2>{title}</h2><p>{text}</p></div></Link>)}</div></section>;
}
