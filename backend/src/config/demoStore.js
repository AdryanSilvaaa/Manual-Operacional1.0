/**
 * Banco temporário em memória para desenvolvimento quando o PostgreSQL está ausente.
 * Alterar dados, contadores ou métodos aqui muda somente o modo de demonstração.
 */
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
const progressEntries = [];

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
    return manuals
      .filter((manual) => (!systemId || Number(manual.system_id) === Number(systemId)) && canReadManual(manual))
      .map((manual) => {
        const progress = this.getProgress(user.id, manual.id);
        const pdfPercent = progress?.page_count
          ? Math.min(100, (progress.pages_viewed.length / progress.page_count) * 100)
          : 0;
        const videoPercent = Math.min(100, Number(progress?.video_progress) || 0);
        return {
          ...manual,
          first_access_at: progress?.first_access_at || null,
          completed_at: progress?.completed_at || null,
          progress_percent: Math.round((pdfPercent + videoPercent) / 2)
        };
      });
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
  },

  getProgress(userId, manualId) {
    return progressEntries.find((item) => Number(item.user_id) === Number(userId) && Number(item.manual_id) === Number(manualId)) || null;
  },

  saveProgress({ userId, manualId, pdfCompleted, videoProgress, seconds, page, pageCount }) {
    let item = this.getProgress(userId, manualId);
    const now = new Date().toISOString();
    if (!item) {
      item = { user_id: Number(userId), manual_id: Number(manualId), pdf_completed: false, video_progress: 0, total_seconds: 0, page_count: 0, last_page: 0, pages_viewed: [], first_access_at: now, last_access_at: now, completed_at: null };
      progressEntries.push(item);
    }
    item.page_count = Math.max(item.page_count, Number(pageCount) || 0);
    item.last_page = Math.max(item.last_page, Number(page) || 0);
    if (page && !item.pages_viewed.includes(Number(page))) item.pages_viewed.push(Number(page));
    item.pdf_completed ||= item.page_count > 0 && item.pages_viewed.length >= item.page_count;
    item.video_progress = Math.max(item.video_progress, Math.min(100, Number(videoProgress) || 0));
    item.total_seconds += Math.max(0, Math.min(60, Number(seconds) || 0));
    item.last_access_at = now;
    if (item.pdf_completed && item.video_progress >= 90 && !item.completed_at) item.completed_at = now;
    return item;
  },

  getProgressReport(user) {
    const operators = users.filter((item) => item.role === 'usuario' && (user.role !== 'gerente_setor' || Number(item.sector_id) === Number(user.sector_id)));
    return operators.flatMap((operator) => manuals
      .filter((manual) => Number(manual.sector_id) === Number(operator.sector_id))
      .map((manual) => ({
        user_id: operator.id, user_name: operator.nome, sector_name: operator.setor,
        manual_id: manual.id, manual_title: manual.titulo,
        pdf_completed: false, video_progress: 0, first_access_at: null,
        last_access_at: null, completed_at: null, total_seconds: 0,
        ...(this.getProgress(operator.id, manual.id) || {})
      })));
  }
};
