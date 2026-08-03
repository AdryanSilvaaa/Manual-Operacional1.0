/**
 * Normaliza textos para pesquisas amigáveis, ignorando acentos e caixa.
 * Alterar esta regra afeta toda listagem que utiliza matchesSearch.
 */
function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/** Retorna verdadeiro quando o nome contém o texto pesquisado já normalizado. */
export function matchesSearch(name, searchTerm) {
  return normalizeSearchText(name).includes(normalizeSearchText(searchTerm));
}
