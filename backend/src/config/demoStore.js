const ADMIN_PASSWORD_HASH = '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC';

let nextUserId = 2;
let nextSystemId = 1;
let nextManualId = 1;
let nextSectorId = 2;

const sectors = [{ id: 1, nome: 'Geral' }];
const users = [{
  id: 1,
  nome: 'Suporte Admin',
  email: 'admin@manual.local',
  identificador: 'admin',
  senha: ADMIN_PASSWORD_HASH,
  role: 'suporte',
  sector_id: 1,
  setor: 'Geral',
  created_at: new Date().toISOString()
}];
const systems = [];
const manuals = [];

export function demoEnabled() {
  return process.env.DEV_DEMO_MODE === 'true';
}

export function isDatabaseUnavailable(error) {
  return ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code);
}

/** Decide se a requisição deve usar a memória quando o PostgreSQL não existe localmente. */
export function shouldUseDemoStore(error) {
  return demoEnabled() && isDatabaseUnavailable(error);
}

/** Remove a senha antes de enviar dados do usuário para a API. */
function toSafeUser(user) {
  if (!user) return null;
  const { senha, ...safeUser } = user;
  return safeUser;
}

/** Armazenamento em memória exclusivo para desenvolvimento sem banco de dados. */
export const demoStore = {
  findUserByIdentifier(identifier) {
    return users.find((user) => user.identificador === identifier || user.email === identifier);
  },

  findUserById(id) {
    return toSafeUser(users.find((user) => Number(user.id) === Number(id)));
  },

  listUsers() {
    return users.map(toSafeUser).sort((left, right) => left.nome.localeCompare(right.nome));
  },

  listSectors() {
    return [...sectors].sort((left, right) => left.nome.localeCompare(right.nome));
  },

  findSectorById(id) {
    return sectors.find((sector) => Number(sector.id) === Number(id));
  },

  // Evita duplicar um setor quando ele já foi informado por nome.
  findOrCreateSector(name) {
    const normalizedName = name.trim();
    let sector = sectors.find((item) => item.nome.toLowerCase() === normalizedName.toLowerCase());

    if (!sector) {
      sector = { id: nextSectorId++, nome: normalizedName };
      sectors.push(sector);
    }

    return sector;
  },

  createUser({ nome, identificador, senhaHash, role, sectorId, setor }) {
    const user = { id: nextUserId++, nome, identificador, senha: senhaHash, role, sector_id: sectorId, setor, created_at: new Date().toISOString() };
    users.push(user);
    return toSafeUser(user);
  },

  updateUser(id, data) {
    const user = users.find((item) => Number(item.id) === Number(id));
    if (!user) return null;
    Object.assign(user, { nome: data.nome, identificador: data.identificador, role: data.role, sector_id: data.sectorId, setor: data.setor });
    return toSafeUser(user);
  },

  deleteUser(id) {
    const index = users.findIndex((user) => Number(user.id) === Number(id));
    if (index >= 0) users.splice(index, 1);
  },

  // Todos os sistemas são exibidos; apenas a contagem segue a permissão do perfil.
  listSystemsForUser(user) {
    return systems.map((system) => ({ ...system, manuals_count: this.listManualsForUser(user).filter((manual) => manual.system_id === system.id).length })).sort((left, right) => left.nome.localeCompare(right.nome));
  },

  createSystem({ nome, resumo }) {
    const system = { id: nextSystemId++, nome, resumo, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    systems.push(system);
    return system;
  },

  updateSystem(id, data) {
    const system = systems.find((item) => Number(item.id) === Number(id));
    if (!system) return null;
    Object.assign(system, { nome: data.nome ?? system.nome, resumo: data.resumo ?? system.resumo, updated_at: new Date().toISOString() });
    return system;
  },

  deleteSystem(id) {
    const index = systems.findIndex((system) => Number(system.id) === Number(id));
    if (index >= 0) systems.splice(index, 1);
    manuals.forEach((manual) => { if (Number(manual.system_id) === Number(id)) manual.system_id = null; });
  },

  // Suporte consulta todos os manuais; os demais perfis leem apenas o próprio setor.
  listManualsForUser(user, systemId = null) {
    const canReadManual = (manual) => ['suporte', 'gerente'].includes(user.role) || Number(manual.sector_id) === Number(user.sector_id);
    return manuals.filter((manual) => (!systemId || Number(manual.system_id) === Number(systemId)) && canReadManual(manual));
  },

  getManualForUser(id, user) {
    return this.listManualsForUser(user).find((manual) => Number(manual.id) === Number(id));
  },

  createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, sectorId, criadoPor }) {
    const manual = { id: nextManualId++, titulo, descricao, pdf_url: pdfUrl, video_url: videoUrl, system_id: Number(systemId), sector_id: sectorId, criado_por: criadoPor, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    manuals.unshift(manual);
    return manual;
  },

  updateManual(id, data) {
    const manual = manuals.find((item) => Number(item.id) === Number(id));
    if (!manual) return null;
    Object.assign(manual, { titulo: data.titulo ?? manual.titulo, descricao: data.descricao ?? manual.descricao, pdf_url: data.pdfUrl ?? manual.pdf_url, video_url: data.videoUrl ?? manual.video_url, system_id: data.systemId ?? manual.system_id, sector_id: data.sectorId ?? manual.sector_id, updated_at: new Date().toISOString() });
    return manual;
  },

  deleteManual(id) {
    const index = manuals.findIndex((manual) => Number(manual.id) === Number(id));
    if (index >= 0) manuals.splice(index, 1);
  }
};
