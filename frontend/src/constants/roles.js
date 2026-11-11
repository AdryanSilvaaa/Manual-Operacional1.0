/**
 * Perfis e permissões usados pelas rotas, menu e telas. Espelho de backend/src/utils/access.js:
 * ao criar ou ajustar um perfil, mude os dois arquivos e a restrição users_role_check do schema.sql.
 * O frontend só esconde telas e botões; quem garante o acesso é o backend.
 */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  USER_ADMIN: 'admin_cadastros',
  CONTENT_EDITOR: 'editor_conteudo',
  AREA_MANAGER: 'gestor_area',
  SECTOR_MANAGER: 'gerente_setor',
  USER: 'usuario'
});

export const PERMISSIONS = Object.freeze({
  MANAGE_USERS: 'manage_users',
  MANAGE_ADMINS: 'manage_admins',
  MANAGE_SECTORS: 'manage_sectors',
  MANAGE_UNITS: 'manage_units',
  MANAGE_SYSTEMS: 'manage_systems',
  MANAGE_BRANDING: 'manage_branding',
  PUBLISH_CONTENT: 'publish_content',
  APPLY_EXAM_ALL_SECTORS: 'apply_exam_all_sectors',
  VIEW_REPORTS: 'view_reports',
  ALL_SECTORS: 'all_sectors',
  ALL_UNITS: 'all_units',
  TAKE_EXAMS: 'take_exams'
});

const P = PERMISSIONS;

// Quem tem pelo menos uma destas permissões vê o menu e a tela de Configurações (usado em AppRoutes e AppLayout).
export const CONFIG_PERMISSIONS = Object.freeze([
  PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_SECTORS, PERMISSIONS.MANAGE_UNITS, PERMISSIONS.MANAGE_SYSTEMS,
  PERMISSIONS.MANAGE_BRANDING, PERMISSIONS.PUBLISH_CONTENT, PERMISSIONS.VIEW_REPORTS
]);

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.values(PERMISSIONS).filter((permission) => permission !== P.TAKE_EXAMS),
  [ROLES.USER_ADMIN]: [P.MANAGE_USERS, P.MANAGE_SECTORS, P.MANAGE_UNITS, P.MANAGE_SYSTEMS, P.TAKE_EXAMS],
  [ROLES.CONTENT_EDITOR]: [P.PUBLISH_CONTENT, P.VIEW_REPORTS, P.ALL_SECTORS, P.ALL_UNITS],
  [ROLES.AREA_MANAGER]: [P.VIEW_REPORTS],
  [ROLES.SECTOR_MANAGER]: [P.PUBLISH_CONTENT, P.VIEW_REPORTS],
  [ROLES.USER]: [P.TAKE_EXAMS]
});

// Nomes exibidos nas telas. A ordem é a da lista de perfis na tela de usuários.
export const ROLE_LABELS = Object.freeze({
  [ROLES.USER]: 'Usuário comum',
  [ROLES.SECTOR_MANAGER]: 'Gerente de setor',
  [ROLES.AREA_MANAGER]: 'Gestor de área',
  [ROLES.CONTENT_EDITOR]: 'Editor de conteúdo',
  [ROLES.USER_ADMIN]: 'Administrador de cadastros',
  [ROLES.ADMIN]: 'Admin'
});

// Explica cada perfil na tela de usuários.
export const ROLE_DESCRIPTIONS = Object.freeze({
  [ROLES.USER]: 'Lê os manuais dos seus setores e unidades e faz provas.',
  [ROLES.SECTOR_MANAGER]: 'Publica manuais e provas e acompanha o painel dos seus setores, nas suas unidades. Pode publicar para uma unidade ou para o setor em todas as unidades.',
  [ROLES.AREA_MANAGER]: 'Acompanha o painel e os resultados de provas dos seus setores nas suas unidades, sem publicar.',
  [ROLES.CONTENT_EDITOR]: 'Publica manuais e provas e acompanha o painel em todos os setores e unidades.',
  [ROLES.USER_ADMIN]: 'Cadastra usuários, setores, unidades e sistemas. Lê os manuais do seu setor e unidade e faz provas; não vê o painel.',
  [ROLES.ADMIN]: 'Acesso total, inclusive aparência e usuários Admin.'
});

const LEGACY_ROLES = Object.freeze({ suporte: ROLES.ADMIN, gerente: ROLES.ADMIN });

export function normalizeRole(role) {
  return LEGACY_ROLES[role] || role;
}

/** Aceita o usuário ({ role }) ou o nome do perfil. */
export function can(userOrRole, permission) {
  const role = normalizeRole(typeof userOrRole === 'string' ? userOrRole : userOrRole?.role);
  return Boolean(ROLE_PERMISSIONS[role]?.includes(permission));
}

/** Perfis que o usuário logado pode atribuir na tela de usuários (Admin só para quem é Admin). */
export function assignableRoles(user) {
  return Object.keys(ROLE_LABELS).filter((role) => role !== ROLES.ADMIN || can(user, P.MANAGE_ADMINS));
}

/** Mesmo critério do backend: pode alterar ou excluir este usuário? */
export function canManageUser(actor, target) {
  return can(actor, P.MANAGE_USERS) && (normalizeRole(target?.role) !== ROLES.ADMIN || can(actor, P.MANAGE_ADMINS));
}

export const roleLabel = (role) => ROLE_LABELS[normalizeRole(role)] || role || '—';
