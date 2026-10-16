/**
 * Nomes de perfil compartilhados pelas rotas, menu e telas administrativas.
 * Ao adicionar/renomear um perfil, mantenha o backend e o schema.sql sincronizados.
 */
export const ROLES = Object.freeze({
  USER: 'usuario',
  SECTOR_MANAGER: 'gerente_setor',
  SUPPORT: 'suporte',
  MANAGER: 'gerente'
});

// Nomes exibidos nas telas (mesmos da tela de usuários).
export const ROLE_LABELS = Object.freeze({
  usuario: 'Usuário comum',
  gerente_setor: 'Gerente de setor',
  suporte: 'Suporte',
  gerente: 'Suporte'
});

export const ADMIN_ROLES = [ROLES.SUPPORT, ROLES.SECTOR_MANAGER, ROLES.MANAGER];
export const FULL_ADMIN_ROLES = [ROLES.SUPPORT, ROLES.MANAGER];
