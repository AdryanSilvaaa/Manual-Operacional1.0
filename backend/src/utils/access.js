/**
 * Regras de acesso por setor compartilhadas pelos controllers, models e modo demonstração.
 * O usuário da requisição traz sector_ids, carregado do banco a cada requisição pelo middleware authenticate.
 */

/**
 * Perfis válidos. O editor de conteúdo publica manuais e provas e acompanha o Painel de uso em todos os setores,
 * mas não administra usuários, setores e sistemas (isso continua só com o suporte).
 */
export const VALID_ROLES = ['suporte', 'editor_conteudo', 'gerente_setor', 'usuario'];

/** Suporte, editor de conteúdo (e o perfil legado gerente) enxergam todos os setores. */
export function seesAllSectors(user) {
  return ['suporte', 'gerente', 'editor_conteudo'].includes(user?.role);
}

/** Operador e gerente de setor precisam de pelo menos um setor; suporte e editor de conteúdo podem ficar sem. */
export function roleNeedsSector(role) {
  return !['suporte', 'editor_conteudo'].includes(role);
}

export function hasSector(user, sectorId) {
  return (user?.sector_ids || []).map(Number).includes(Number(sectorId));
}

/**
 * Quem pode editar ou excluir um manual já publicado. Suporte e editor de conteúdo: qualquer um.
 * Gerente de setor: só manual cujos setores são todos seus, para não mexer em conteúdo de outro setor.
 */
export function canManageManual(user, sectorIds) {
  if (seesAllSectors(user)) return true;
  if (user?.role !== 'gerente_setor') return false;
  return sectorIds.length > 0 && sectorIds.every((id) => hasSector(user, id));
}

/** Normaliza a lista de setores enviada pelas telas: números únicos e válidos. */
export function parseSectorIds(value) {
  const list = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value];
  return [...new Set(list.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}
