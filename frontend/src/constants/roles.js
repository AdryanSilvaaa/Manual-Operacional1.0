/**
 * Nomes de perfil compartilhados pelas rotas, menu e telas administrativas.
 * Ao adicionar/renomear um perfil, mantenha o backend e o schema.sql sincronizados.
 */
export const ROLES = Object.freeze({
  USER: 'usuario',
  SECTOR_MANAGER: 'gerente_setor',
  SUPPORT: 'suporte',
  CONTENT_EDITOR: 'editor_conteudo',
  MANAGER: 'gerente'
});

// Nomes exibidos nas telas (mesmos da tela de usuários).
export const ROLE_LABELS = Object.freeze({
  usuario: 'Usuário comum',
  gerente_setor: 'Gerente de setor',
  suporte: 'Suporte',
  editor_conteudo: 'Editor de conteúdo',
  gerente: 'Suporte'
});

export const ADMIN_ROLES = [ROLES.SUPPORT, ROLES.CONTENT_EDITOR, ROLES.SECTOR_MANAGER, ROLES.MANAGER];
export const FULL_ADMIN_ROLES = [ROLES.SUPPORT, ROLES.MANAGER];
// Perfis que publicam e acompanham em todos os setores (o editor de conteúdo não administra cadastros).
export const ALL_SECTOR_ROLES = [ROLES.SUPPORT, ROLES.CONTENT_EDITOR, ROLES.MANAGER];
