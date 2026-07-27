const adminHash = '$2a$10$aEV41I/MA/qN00fWXu5UCuO/kPA0KT.DG5Br/zho02MdrowLgDIeC';
let nextUserId = 2; let nextSystemId = 1; let nextManualId = 1; let nextSectorId = 2;
const sectors = [{ id: 1, nome: 'Geral' }];
const users = [{ id: 1, nome: 'Suporte Admin', email: 'admin@manual.local', identificador: 'admin', senha: adminHash, role: 'suporte', sector_id: 1, setor: 'Geral', created_at: new Date().toISOString() }];
const systems = []; const manuals = [];

export function demoEnabled() { return process.env.DEV_DEMO_MODE === 'true'; }
export function isDatabaseUnavailable(error) { return ['28P01', 'ECONNREFUSED', '3D000'].includes(error?.code); }
export function shouldUseDemoStore(error) { return demoEnabled() && isDatabaseUnavailable(error); }

// Armazenamento em memoria para uso local quando nao existe PostgreSQL configurado.
export const demoStore = {
  findUserByIdentifier(value) { return users.find((user) => user.identificador === value || user.email === value); },
  findUserById(id) { const user = users.find((item) => Number(item.id) === Number(id)); if (!user) return null; const { senha, ...safe } = user; return safe; },
  listUsers() { return users.map(({ senha, ...user }) => user).sort((a, b) => a.nome.localeCompare(b.nome)); },
  listSectors() { return [...sectors].sort((a, b) => a.nome.localeCompare(b.nome)); },
  findSectorById(id) { return sectors.find((item) => Number(item.id) === Number(id)); },
  findOrCreateSector(nome) { let sector = sectors.find((item) => item.nome.toLowerCase() === nome.trim().toLowerCase()); if (!sector) { sector = { id: nextSectorId++, nome: nome.trim() }; sectors.push(sector); } return sector; },
  createUser({ nome, identificador, senhaHash, role, sectorId, setor }) { const user = { id: nextUserId++, nome, identificador, senha: senhaHash, role, sector_id: sectorId, setor, created_at: new Date().toISOString() }; users.push(user); const { senha, ...safe } = user; return safe; },
  updateUser(id, data) { const user = users.find((item) => Number(item.id) === Number(id)); if (!user) return null; Object.assign(user, { nome: data.nome, identificador: data.identificador, role: data.role, sector_id: data.sectorId, setor: data.setor }); const { senha, ...safe } = user; return safe; },
  deleteUser(id) { const index = users.findIndex((user) => Number(user.id) === Number(id)); if (index >= 0) users.splice(index, 1); },
  listSystemsForUser(user) { return systems.map((system) => ({ ...system, manuals_count: this.listManualsForUser(user).filter((manual) => manual.system_id === system.id).length })).sort((a, b) => a.nome.localeCompare(b.nome)); },
  createSystem({ nome, resumo }) { const item = { id: nextSystemId++, nome, resumo, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; systems.push(item); return item; },
  updateSystem(id, data) { const item = systems.find((system) => Number(system.id) === Number(id)); if (!item) return null; Object.assign(item, { nome: data.nome ?? item.nome, resumo: data.resumo ?? item.resumo, updated_at: new Date().toISOString() }); return item; },
  deleteSystem(id) { const index = systems.findIndex((item) => Number(item.id) === Number(id)); if (index >= 0) systems.splice(index, 1); manuals.forEach((manual) => { if (Number(manual.system_id) === Number(id)) manual.system_id = null; }); },
  listManualsForUser(user, systemId = null) { return manuals.filter((manual) => (!systemId || Number(manual.system_id) === Number(systemId)) && (user.role === 'gerente' || Number(manual.sector_id) === Number(user.sector_id))); },
  getManualForUser(id, user) { return this.listManualsForUser(user).find((manual) => Number(manual.id) === Number(id)); },
  createManual({ titulo, descricao, pdfUrl, videoUrl, systemId, sectorId, criadoPor }) { const item = { id: nextManualId++, titulo, descricao, pdf_url: pdfUrl, video_url: videoUrl, system_id: Number(systemId), sector_id: sectorId, criado_por: criadoPor, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; manuals.unshift(item); return item; },
  updateManual(id, data) { const item = manuals.find((manual) => Number(manual.id) === Number(id)); if (!item) return null; Object.assign(item, { titulo: data.titulo ?? item.titulo, descricao: data.descricao ?? item.descricao, pdf_url: data.pdfUrl ?? item.pdf_url, video_url: data.videoUrl ?? item.video_url, system_id: data.systemId ?? item.system_id, sector_id: data.sectorId ?? item.sector_id, updated_at: new Date().toISOString() }); return item; },
  deleteManual(id) { const index = manuals.findIndex((manual) => Number(manual.id) === Number(id)); if (index >= 0) manuals.splice(index, 1); }
};
