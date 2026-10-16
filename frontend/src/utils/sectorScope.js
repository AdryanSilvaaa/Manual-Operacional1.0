/**
 * Regras do filtro de setor nas telas de acompanhamento (Painel de Uso e Resultados de Provas).
 * Gerente de setor vê só os próprios setores: com um setor o filtro fica travado nele;
 * com dois ou mais pode escolher um deles ou todos os seus. Suporte escolhe entre todos.
 */
import { ROLES } from '../constants/roles.js';

const byName = (a, b) => a.localeCompare(b, 'pt-BR');

export function sectorScope(user, dataSectors) {
  if (user?.role === ROLES.SECTOR_MANAGER) {
    const mine = (user.setores || []).map((sector) => sector.nome).sort(byName);
    if (mine.length === 1) return { options: mine, locked: mine[0], allLabel: mine[0] };
    return { options: mine, locked: null, allLabel: 'Todos os meus setores' };
  }
  return { options: [...new Set(dataSectors.filter(Boolean))].sort(byName), locked: null, allLabel: 'Todos os setores' };
}
