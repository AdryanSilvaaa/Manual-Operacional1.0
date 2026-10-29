/**
 * Orquestra listagem, upload, edição e exclusão de manuais.
 * Altere validações/ respostas aqui; acesso ao banco em models/Manual.js e arquivos em config/storage.js.
 */
import {
  createManual,
  deleteManual,
  getManualForUser,
  getManualSectorIds,
  listManageableManuals,
  listManualsForUser,
  updateManual,
  archiveAndUpdateManual
} from '../models/Manual.js';
import { confirmDirectUpload, resolveFileUrl, supportsDirectUpload, uploadFile } from '../config/storage.js';
import { ALLOWED_TYPES, maxBytesFor } from '../middleware/upload.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { findOrCreateSector, findSectorsByIds, listSectors } from '../models/Sector.js';
import { canManageManual, hasSector, parseSectorIds } from '../utils/access.js';
import { audit } from '../models/Audit.js';

const hasFile = (req, kind) => Boolean(req.files?.[kind]?.[0] || req.body?.[`${kind}Key`]);

/**
 * Arquivo do campo pdf ou video: chave já enviada direto ao bucket (pdfKey/videoKey) ou arquivo recebido pelo backend.
 * Devolve o valor a gravar no banco, ou null quando o campo não veio.
 */
async function receiveFile(req, kind) {
  const key = req.body?.[`${kind}Key`];
  if (key) {
    if (!supportsDirectUpload) throw Object.assign(new Error('Upload direto não está configurado neste ambiente'), { status: 400 });
    return confirmDirectUpload(String(key), kind, { allowedTypes: ALLOWED_TYPES[kind], maxBytes: maxBytesFor(kind) });
  }
  const file = req.files?.[kind]?.[0];
  return file ? uploadFile(file, kind === 'pdf' ? 'pdfs' : 'videos') : null;
}

/**
 * Setores do manual (um ou mais, em sectorIds). Gerente de setor só publica nos seus; suporte e editor de conteúdo
 * em qualquer setor já cadastrado. O campo antigo "setor" (um nome) continua aceito; nele só o suporte cria setor novo.
 */
async function resolveManualSectors(req) {
  let ids = parseSectorIds(req.body.sectorIds);
  const setor = typeof req.body.setor === 'string' ? req.body.setor.trim() : '';
  if (!ids.length && setor) {
    const existing = (await listSectors()).find((item) => item.nome.toLowerCase() === setor.toLowerCase());
    if (existing) ids = [existing.id];
    else if (req.user.role === 'suporte') ids = [(await findOrCreateSector(setor)).id];
    else return { error: 'Setor não encontrado. Peça ao suporte para cadastrá-lo em Setores.' };
  }
  // Gerente com um único setor não precisa escolher.
  if (!ids.length && req.user.role === 'gerente_setor' && req.user.sector_ids?.length === 1) ids = [...req.user.sector_ids];
  if (!ids.length) return { error: 'Selecione pelo menos um setor' };
  if ((await findSectorsByIds(ids)).length !== ids.length) return { error: 'Setor não encontrado' };
  if (req.user.role === 'gerente_setor' && !ids.every((id) => hasSector(req.user, id))) {
    return { error: 'Você só pode publicar manuais nos seus setores' };
  }
  return { ids };
}

/**
 * Confere se quem pede pode editar ou excluir o manual. Devolve o manual (id, título, setores)
 * ou já responde 404 (não existe) ou 403 (gerente de setor fora dos seus setores).
 */
async function findManageableManual(req, res) {
  const id = Number(req.params.id);
  let manual = null;
  if (Number.isInteger(id) && id > 0) {
    try {
      manual = await getManualSectorIds(id);
    } catch (error) {
      if (!shouldUseDemoStore(error)) throw error;
      manual = demoStore.getManualSectorIds(id);
    }
  }
  if (!manual) {
    res.status(404).json({ message: 'Manual nao encontrado' });
    return null;
  }
  if (!canManageManual(req.user, manual.sector_ids)) {
    res.status(403).json({ message: 'Você só pode alterar manuais que sejam apenas dos seus setores' });
    return null;
  }
  return manual;
}

// Registro de auditoria sem travar a operação quando o banco não estiver disponível (modo demonstração).
const auditManual = (req, action, manual) => audit(req.user.id, action, 'manual', manual.id, { titulo: manual.titulo }).catch(() => {});

// Troca as chaves do bucket por URLs assinadas temporárias; só é chamado depois de conferir o acesso ao manual.
async function withFileUrls(manual) {
  const [pdfUrl, videoUrl] = await Promise.all([resolveFileUrl(manual.pdf_url), resolveFileUrl(manual.video_url)]);
  return { ...manual, pdf_url: pdfUrl, video_url: videoUrl };
}


export async function index(req, res) {
  const systemId = req.query.systemId || null;
  let manuals;
  try {
    manuals = await listManualsForUser(req.user, systemId);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    manuals = demoStore.listManualsForUser(req.user, systemId);
  }

  res.json(manuals);
}

// Lista da tela Gerenciar manuais (inclui os inativos).
export async function manage(req, res) {
  let manuals;
  try {
    manuals = await listManageableManuals(req.user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    manuals = demoStore.listManageableManuals(req.user);
  }
  res.json(manuals);
}

export async function show(req, res) {
  let manual;
  try {
    manual = await getManualForUser(req.params.id, req.user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    manual = demoStore.getManualForUser(req.params.id, req.user);
  }

  if (!manual) {
    return res.status(404).json({ message: 'Manual nao encontrado ou sem permissao' });
  }

  res.json(await withFileUrls(manual));
}

export async function store(req, res) {
  const { titulo, descricao } = req.body;
  const systemId = req.body.systemId ? Number(req.body.systemId) : null;

  if (!titulo || !systemId) {
    return res.status(400).json({ message: 'Sistema e título são obrigatórios' });
  }
  const sectors = await resolveManualSectors(req);
  if (sectors.error) return res.status(400).json({ message: sectors.error });
  // O manual pode ter só PDF, só vídeo ou os dois.
  if (!hasFile(req, 'pdf') && !hasFile(req, 'video')) {
    return res.status(400).json({ message: 'Envie pelo menos o PDF ou o vídeo' });
  }

  const pdfUrl = await receiveFile(req, 'pdf');
  const videoUrl = await receiveFile(req, 'video');

  let manual;
  try {
    manual = await createManual({
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId,
      sectorIds: sectors.ids,
      criadoPor: req.user.id
    });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    manual = demoStore.createManual({
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId,
      sectorIds: sectors.ids,
      criadoPor: req.user.id
    });
  }

  res.status(201).json(manual);
}

export async function update(req, res) {
  const current = await findManageableManual(req, res);
  if (!current) return;
  const { titulo, descricao } = req.body;
  const active = req.body.active === undefined ? undefined : String(req.body.active) === 'true';
  const systemId = req.body.systemId === undefined
    ? undefined
    : req.body.systemId
      ? Number(req.body.systemId)
      : null;
  // Setores só mudam quando vierem na requisição (sectorIds ou o campo antigo setor).
  const sectors = req.body.sectorIds !== undefined || req.body.setor ? await resolveManualSectors(req) : null;
  if (sectors?.error) return res.status(400).json({ message: sectors.error });
  const pdfUrl = await receiveFile(req, 'pdf');
  const videoUrl = await receiveFile(req, 'video');

  let manual;
  try {
    const updateData = {
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId,
      sectorIds: sectors?.ids,
      active
    };
    manual = pdfUrl || videoUrl
      ? await archiveAndUpdateManual(req.params.id, updateData)
      : await updateManual(req.params.id, updateData);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    manual = demoStore.updateManual(req.params.id, {
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId,
      sectorIds: sectors?.ids,
      active
    });
  }

  if (!manual) {
    return res.status(404).json({ message: 'Manual nao encontrado' });
  }

  await auditManual(req, 'manual_updated', manual);
  res.json(manual);
}

// Exclui o manual e, em cascata, setores, progresso e histórico de versões. Os arquivos ficam no armazenamento.
export async function destroy(req, res) {
  const manual = await findManageableManual(req, res);
  if (!manual) return;
  try {
    await deleteManual(manual.id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    demoStore.deleteManual(manual.id);
  }

  await auditManual(req, 'manual_deleted', manual);
  res.status(204).send();
}
