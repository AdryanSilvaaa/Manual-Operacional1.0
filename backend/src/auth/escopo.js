// src/auth/escopo.js
//
// Núcleo da regra de negócio: acesso por PAPEL e por DEPARTAMENTO.
//
// Matriz (seção 2 do documento):
//   Ação                        Administrador   Gerente          Usuário
//   Gerenciar sistemas          Sim (todos)     Sim (seu depto)  Não
//   Criar/editar manuais        Sim (todos)     Sim (seu depto)  Não
//   Visualizar manuais          Sim (todos)     Sim (seu depto)  Sim (seu depto)
//   Escopo de acesso            Global          Seu depto        Seu depto
//
// Lembrete estrutural: o departamento de um MANUAL é o departamento do seu
// SISTEMA (manual -> sistema -> departamento). Por isso as verificações de
// manual aceitam tanto o departamento já resolvido por join quanto o sistema
// aninhado.
//
// Princípio: falha fechada. Se o departamento do recurso não puder ser
// determinado, o acesso é negado — nunca liberado por omissão.

export const PAPEL = Object.freeze({
  ADMINISTRADOR: 'administrador',
  GERENTE: 'gerente',
  USUARIO: 'usuario',
});

/** @param {{papel?:string}|null|undefined} user */
export function ehAdministrador(user) {
  return user?.papel === PAPEL.ADMINISTRADOR;
}

/**
 * Descobre o departamento de um recurso.
 * Aceita: { departamento_id }, { sistema: { departamento_id } } ou
 * { sistema_departamento_id } (nome comum quando vem de um join).
 * @returns {number|string|undefined} undefined quando não for determinável.
 */
export function departamentoDoRecurso(recurso) {
  if (recurso == null || typeof recurso !== 'object') return undefined;
  if (recurso.departamento_id != null) return recurso.departamento_id;
  if (recurso.sistema?.departamento_id != null) return recurso.sistema.departamento_id;
  if (recurso.sistema_departamento_id != null) return recurso.sistema_departamento_id;
  return undefined;
}

/**
 * O usuário está no mesmo departamento do recurso?
 * Administrador é global e ignora o escopo. Gerente e usuário só acessam
 * recursos do próprio departamento_id.
 * @param {{papel?:string, departamento_id?:number|string|null}} user
 * @param {object} recurso
 * @returns {boolean}
 */
export function mesmoDepartamento(user, recurso) {
  if (ehAdministrador(user)) return true;
  const departamentoUsuario = user?.departamento_id;
  // Gerente/usuário sem departamento não acessa nada com escopo.
  if (departamentoUsuario == null) return false;
  const departamentoRecurso = departamentoDoRecurso(recurso);
  if (departamentoRecurso == null) return false; // falha fechada
  // Normaliza para comparar id numérico com id em string (vindo da URL/JSON).
  return String(departamentoRecurso) === String(departamentoUsuario);
}

/**
 * Criar/editar/remover um SISTEMA.
 * Administrador sempre; gerente só no próprio departamento; usuário nunca.
 */
export function podeGerenciarSistema(user, sistema) {
  if (ehAdministrador(user)) return true;
  if (user?.papel !== PAPEL.GERENTE) return false; // usuário nunca gerencia
  return mesmoDepartamento(user, sistema);
}

/**
 * Criar/editar/remover um MANUAL (departamento herdado do sistema).
 * Administrador sempre; gerente só no próprio departamento; usuário nunca.
 */
export function podeGerenciarManual(user, manual) {
  if (ehAdministrador(user)) return true;
  if (user?.papel !== PAPEL.GERENTE) return false; // usuário nunca cria nem edita
  return mesmoDepartamento(user, manual);
}

/**
 * Visualizar/baixar um MANUAL (departamento herdado do sistema).
 * Administrador sempre; gerente e usuário apenas no próprio departamento.
 */
export function podeVerManual(user, manual) {
  if (ehAdministrador(user)) return true;
  if (user?.papel !== PAPEL.GERENTE && user?.papel !== PAPEL.USUARIO) return false;
  return mesmoDepartamento(user, manual);
}
