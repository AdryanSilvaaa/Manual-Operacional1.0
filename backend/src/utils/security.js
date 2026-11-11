/**
 * Regras de segurança compartilhadas: política de senha e validação dos dados de identificação do usuário.
 * Os limites de tamanho são os mesmos das colunas em sql/schema.sql (users.nome 120, users.identificador 160).
 */

// Custo do bcrypt (2^10 rodadas): equilíbrio entre segurança e tempo de resposta do login.
export const BCRYPT_ROUNDS = 10;

/** Senha forte: pelo menos 8 caracteres, uma letra e um número. Limite de 72 bytes por causa do bcrypt. */
export function isStrongPassword(value) {
  return typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value) <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export const MAX_NAME_LENGTH = 120;
export const MAX_LOGIN_LENGTH = 160;

/**
 * Confere nome e login vindos das telas. Devolve { error } ou { nome, identificador } já sem espaços nas pontas.
 * O login não pode ter espaços (é digitado na tela de entrada) e os dois precisam ser texto.
 */
export function validateUserIdentity({ nome, identificador } = {}) {
  if (typeof nome !== 'string' || typeof identificador !== 'string') return { error: 'Nome e usuário são obrigatórios' };
  const cleanName = nome.trim().replace(/\s+/g, ' ');
  const cleanLogin = identificador.trim();
  if (!cleanName || !cleanLogin) return { error: 'Nome e usuário são obrigatórios' };
  if (cleanName.length > MAX_NAME_LENGTH) return { error: `O nome pode ter até ${MAX_NAME_LENGTH} caracteres` };
  if (cleanLogin.length > MAX_LOGIN_LENGTH || /\s/.test(cleanLogin)) return { error: `O usuário não pode ter espaços e pode ter até ${MAX_LOGIN_LENGTH} caracteres` };
  return { nome: cleanName, identificador: cleanLogin };
}
