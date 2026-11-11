/**
 * Trechos de SQL da regra de unidades, compartilhados pelos models. O manual sem nenhuma linha em manual_units
 * vale para todas as unidades; com linhas, só para quem é de uma delas. Prova avulsa: exams.unit_id nulo = todas.
 */

/**
 * Condição SQL "o manual m alcança estas unidades": manual sem unidade (todas as unidades) ou com alguma delas.
 * param é o parâmetro com a lista de unidades (int[]); manualId, a expressão com o id do manual. Usada por Manual.js, Exam.js, Progress.js e System.js.
 */
export const manualInUnits = (param, manualId = 'm.id') => `(NOT EXISTS (SELECT 1 FROM manual_units mu WHERE mu.manual_id = ${manualId})
  OR EXISTS (SELECT 1 FROM manual_units mu WHERE mu.manual_id = ${manualId} AND mu.unit_id = ANY(${param}::int[])))`;

/** Mesma regra, mas com as unidades gravadas de um usuário do banco (userRef, ex.: u.id). */
export const manualInUserUnits = (userRef, manualId = 'm.id') => `(NOT EXISTS (SELECT 1 FROM manual_units mu WHERE mu.manual_id = ${manualId})
  OR EXISTS (SELECT 1 FROM manual_units mu JOIN user_units uu ON uu.unit_id = mu.unit_id
             WHERE mu.manual_id = ${manualId} AND uu.user_id = ${userRef}))`;

/** O usuário do banco (userRef, ex.: c.id) é de uma das unidades informadas (param int[])? */
export const userInUnits = (userRef, param) => `EXISTS (SELECT 1 FROM user_units uu WHERE uu.user_id = ${userRef} AND uu.unit_id = ANY(${param}::int[]))`;

/** Prova avulsa e (alias) alcança o usuário do banco userRef: sem unidade (todas) ou da unidade dele. */
export const examInUserUnit = (userRef, alias = 'e') => `(${alias}.unit_id IS NULL OR EXISTS (SELECT 1 FROM user_units uu WHERE uu.user_id = ${userRef} AND uu.unit_id = ${alias}.unit_id))`;
