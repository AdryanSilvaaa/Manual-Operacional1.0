/**
 * Regras do filtro de setor nas telas de acompanhamento (Painel de Uso e Resultados de Provas).
 * Quem não enxerga todos os setores (gerente de setor, gestor de área) vê só os próprios: com um setor o filtro
 * fica travado nele; com dois ou mais pode escolher um deles ou todos os seus. Admin e editor escolhem entre todos.
 */
import { can, PERMISSIONS } from '../constants/roles.js';

const byName = (a, b) => a.localeCompare(b, 'pt-BR');

export function sectorScope(user, dataSectors) {
  if (!can(user, PERMISSIONS.ALL_SECTORS)) {
    const mine = (user.setores || []).map((sector) => sector.nome).sort(byName);
    if (mine.length === 1) return { options: mine, locked: mine[0], allLabel: mine[0] };
    return { options: mine, locked: null, allLabel: 'Todos os meus setores' };
  }
  return { options: [...new Set(dataSectors.filter(Boolean))].sort(byName), locked: null, allLabel: 'Todos os setores' };
}
