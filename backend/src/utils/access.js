/**
 * Perfis, permissões e regras de acesso por setor do Prumo: a fonte única do backend.
 * Para criar ou ajustar um perfil, mude ROLE_PERMISSIONS aqui, o espelho em frontend/src/constants/roles.js
 * e a restrição users_role_check em backend/sql/schema.sql.
 * O usuário da requisição traz role, sector_ids e unit_ids, lidos do banco a cada requisição pelo middleware authenticate.
 *
 * Unidades (filiais): o setor é comum a todas as unidades e a unidade é um segundo filtro. O colaborador vê um
 * conteúdo quando ele é de um dos seus setores E de uma das suas unidades. Conteúdo sem unidade (lista vazia)
 * vale para todas as unidades.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  USER_ADMIN: 'admin_cadastros',
  CONTENT_EDITOR: 'editor_conteudo',
  AREA_MANAGER: 'gestor_area',
  SECTOR_MANAGER: 'gerente_setor',
  USER: 'usuario'
});

/** O que cada permissão libera. */
export const PERMISSIONS = Object.freeze({
  // Criar, editar e excluir usuários (inclusive pela planilha).
  MANAGE_USERS: 'manage_users',
  // Criar, editar ou excluir usuários com perfil admin, e dar o perfil admin a alguém.
  MANAGE_ADMINS: 'manage_admins',
  MANAGE_SECTORS: 'manage_sectors',
  // Cadastrar, renomear e excluir unidades (filiais).
  MANAGE_UNITS: 'manage_units',
  MANAGE_SYSTEMS: 'manage_systems',
  // Aparência white label (cores e logos).
  MANAGE_BRANDING: 'manage_branding',
  // Publicar, editar e excluir manuais e modelos de prova; aplicar provas.
  PUBLISH_CONTENT: 'publish_content',
  // Aplicar uma prova para todos os setores de uma vez.
  APPLY_EXAM_ALL_SECTORS: 'apply_exam_all_sectors',
  // Painel de uso e resultados de provas.
  VIEW_REPORTS: 'view_reports',
  // Enxerga todos os setores (manuais, painel, modelos). Sem ela, vale só o que é dos setores do usuário.
  ALL_SECTORS: 'all_sectors',
  // Enxerga todas as unidades. Sem ela, vale só o que é das unidades do usuário (ou de todas as unidades).
  ALL_UNITS: 'all_units',
  // Recebe e responde provas.
  TAKE_EXAMS: 'take_exams'
});

const P = PERMISSIONS;

/**
 * Matriz perfil x permissões.
 * - admin: acesso total.
 * - admin_cadastros: cria usuários (de qualquer unidade), setores, unidades e sistemas (ex.: equipe de TI). No resto é um colaborador comum:
 *   lê os manuais dos seus setores e faz provas; não vê painel nem resultados e não mexe em usuários admin.
 * - editor_conteudo: publica e acompanha em todos os setores, sem cadastros.
 * - gestor_area: acompanha painel e resultados dos seus setores (vários), sem publicar.
 * - gerente_setor: publica e acompanha nos seus setores.
 * - usuario: lê os manuais dos seus setores e faz provas.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.values(PERMISSIONS).filter((permission) => permission !== P.TAKE_EXAMS),
  [ROLES.USER_ADMIN]: [P.MANAGE_USERS, P.MANAGE_SECTORS, P.MANAGE_UNITS, P.MANAGE_SYSTEMS, P.TAKE_EXAMS],
  [ROLES.CONTENT_EDITOR]: [P.PUBLISH_CONTENT, P.VIEW_REPORTS, P.ALL_SECTORS, P.ALL_UNITS],
  [ROLES.AREA_MANAGER]: [P.VIEW_REPORTS],
  [ROLES.SECTOR_MANAGER]: [P.PUBLISH_CONTENT, P.VIEW_REPORTS],
  [ROLES.USER]: [P.TAKE_EXAMS]
});

/** Nomes exibidos (respostas da importação por planilha). Mantenha igual ao ROLE_LABELS do frontend. */
export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Admin',
  [ROLES.USER_ADMIN]: 'Administrador de cadastros',
  [ROLES.CONTENT_EDITOR]: 'Editor de conteúdo',
  [ROLES.AREA_MANAGER]: 'Gestor de área',
  [ROLES.SECTOR_MANAGER]: 'Gerente de setor',
  [ROLES.USER]: 'Usuário comum'
});

/** Perfis válidos para gravar em users.role (mesma lista da restrição users_role_check). */
export const VALID_ROLES = Object.freeze(Object.values(ROLES));

// Nomes antigos ainda aceitos na leitura (dados anteriores à migração, modo demonstração antigo).
const LEGACY_ROLES = Object.freeze({ suporte: ROLES.ADMIN, gerente: ROLES.ADMIN });

export function normalizeRole(role) {
  return LEGACY_ROLES[role] || role;
}

/** Aceita o usuário ({ role }) ou o nome do perfil. */
export function can(userOrRole, permission) {
  const role = normalizeRole(typeof userOrRole === 'string' ? userOrRole : userOrRole?.role);
  return Boolean(ROLE_PERMISSIONS[role]?.includes(permission));
}

/** Perfis que têm a permissão (para filtros em SQL, ex.: quem faz prova). */
export function rolesWith(permission) {
  return VALID_ROLES.filter((role) => can(role, permission));
}

/** Admin e editor de conteúdo enxergam todos os setores. */
export function seesAllSectors(user) {
  return can(user, P.ALL_SECTORS);
}

/** Quem enxerga todos os setores pode ficar sem setor; os demais perfis precisam de pelo menos um. */
export function roleNeedsSector(role) {
  return !can(role, P.ALL_SECTORS);
}

/** Só quem tem MANAGE_ADMINS cria, altera ou exclui um admin, ou dá o perfil admin a alguém. */
export function canManageUserWithRole(actor, targetRole) {
  if (!can(actor, P.MANAGE_USERS)) return false;
  return normalizeRole(targetRole) !== ROLES.ADMIN || can(actor, P.MANAGE_ADMINS);
}

export function hasSector(user, sectorId) {
  return (user?.sector_ids || []).map(Number).includes(Number(sectorId));
}

/** Admin e editor de conteúdo enxergam todas as unidades. */
export function seesAllUnits(user) {
  return can(user, P.ALL_UNITS);
}

/** Quem enxerga todas as unidades pode ficar sem unidade; os demais perfis precisam de pelo menos uma. */
export function roleNeedsUnit(role) {
  return !can(role, P.ALL_UNITS);
}

export function hasUnit(user, unitId) {
  return (user?.unit_ids || []).map(Number).includes(Number(unitId));
}

/** O conteúdo (unidades dele; vazia = todas) alcança o usuário? */
export function reachesUserUnits(user, unitIds = []) {
  return seesAllUnits(user) || !unitIds.length || unitIds.some((id) => hasUnit(user, id));
}

/**
 * Pode publicar com estas unidades? Lista vazia (todas as unidades) é liberada para quem publica: o gerente de
 * um setor que atende várias unidades decide se o manual vale só para uma unidade ou para o setor na rede inteira.
 * Unidades escolhidas precisam ser todas dele (admin e editor escolhem qualquer uma).
 */
export function canPublishToUnits(user, unitIds = []) {
  return seesAllUnits(user) || unitIds.every((id) => hasUnit(user, id));
}

/**
 * Quem pode editar ou excluir um manual já publicado. Quem publica em todos os setores e unidades: qualquer um.
 * Gerente de setor: só manual cujos setores são todos seus e cujas unidades são todas suas (ou de todas as unidades).
 */
export function canManageManual(user, sectorIds, unitIds = []) {
  if (!can(user, P.PUBLISH_CONTENT)) return false;
  const sectorsOk = seesAllSectors(user) || (sectorIds.length > 0 && sectorIds.every((id) => hasSector(user, id)));
  return sectorsOk && canPublishToUnits(user, unitIds);
}

/** Normaliza uma lista de ids enviada pelas telas (setores, unidades): números únicos e válidos. */
export function parseIdList(value) {
  const list = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value];
  return [...new Set(list.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

export const parseSectorIds = parseIdList;
export const parseUnitIds = parseIdList;
