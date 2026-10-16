/**
 * Regras de acesso por setor compartilhadas pelos controllers, models e modo demonstração.
 * O usuário da requisição traz sector_ids, carregado do banco a cada requisição pelo middleware authenticate.
 */

/** Suporte (e o perfil legado gerente) enxerga todos os setores. */
export function isSupport(user) {
  return ['suporte', 'gerente'].includes(user?.role);
}

export function hasSector(user, sectorId) {
  return (user?.sector_ids || []).map(Number).includes(Number(sectorId));
}

/** Normaliza a lista de setores enviada pelas telas: números únicos e válidos. */
export function parseSectorIds(value) {
  const list = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value];
  return [...new Set(list.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}
