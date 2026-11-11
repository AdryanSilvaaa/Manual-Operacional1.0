/**
 * Orquestra listagem, upload, edição e exclusão de manuais.
 * Altere validações/ respostas aqui; acesso ao banco em models/Manual.js e arquivos em config/storage.js.
 */
import {
  createManual,
  deleteManual,
  getManualForUser,
  getManualSectorIds,
  isFileReferenced,
  listManageableManuals,
  listManualsForUser,
  updateManual,
  archiveAndUpdateManual
} from '../models/Manual.js';
import { confirmDirectUpload, deleteStoredFile, resolveFileUrl, supportsDirectUpload, uploadFile } from '../config/storage.js';
import { ALLOWED_TYPES, maxBytesFor } from '../middleware/upload.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { findOrCreateSector, findSectorsByIds, listSectors } from '../models/Sector.js';
import { findUnitsByIds } from '../models/Unit.js';
import { can, canManageManual, canPublishToUnits, hasSector, parseSectorIds, parseUnitIds, PERMISSIONS, seesAllSectors } from '../utils/access.js';
import { audit } from '../models/Audit.js';
import { parseManualExam } from '../utils/exam.js';
import { getTemplate } from '../models/ExamTemplate.js';
import { canUseTemplate } from './examTemplateController.js';

// O manual tem arquivo novo deste tipo na requisição? (enviado pelo backend ou direto ao bucket)
const hasFile = (req, kind) => Boolean(req.files?.[kind]?.[0] || req.body?.[`${kind}Key`]);
// removePdf/removeVideo chegam como true (JSON) ou "true" (multipart).
const isTrue = (value) => value === true || value === 'true';

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
 * Setores do manual (um ou mais, em sectorIds). Quem não enxerga todos os setores (gerente de setor) só publica nos seus;
 * admin e editor de conteúdo em qualquer setor já cadastrado. O campo antigo "setor" (um nome) continua aceito;
 * nele só quem cadastra setores (admin) cria setor novo.
 */
async function resolveManualSectors(req) {
  let ids = parseSectorIds(req.body.sectorIds);
  const setor = typeof req.body.setor === 'string' ? req.body.setor.trim() : '';
  if (!ids.length && setor) {
    const existing = (await listSectors()).find((item) => item.nome.toLowerCase() === setor.toLowerCase());
    if (existing) ids = [existing.id];
    else if (can(req.user, PERMISSIONS.MANAGE_SECTORS)) ids = [(await findOrCreateSector(setor)).id];
    else return { error: 'Setor não encontrado. Peça ao administrador para cadastrá-lo em Setores.' };
  }
  // Gerente com um único setor não precisa escolher.
  if (!ids.length && !seesAllSectors(req.user) && req.user.sector_ids?.length === 1) ids = [...req.user.sector_ids];
  if (!ids.length) return { error: 'Selecione pelo menos um setor' };
  if ((await findSectorsByIds(ids)).length !== ids.length) return { error: 'Setor não encontrado' };
  if (!seesAllSectors(req.user) && !ids.every((id) => hasSector(req.user, id))) {
    return { error: 'Você só pode publicar manuais nos seus setores' };
  }
  return { ids };
}

/**
 * Unidades do manual. unitScope "todas" (ou nenhuma unidade enviada no cadastro) = todas as unidades (lista vazia);
 * "selecionadas" exige pelo menos uma em unitIds. Na edição, sem unitScope nem unitIds as unidades não mudam
 * (devolve { ids: undefined }). Gerente de setor escolhe entre as suas unidades ou todas as unidades.
 */
async function resolveManualUnits(req, { isUpdate = false } = {}) {
  const scope = req.body.unitScope;
  if (isUpdate && scope === undefined && req.body.unitIds === undefined) return { ids: undefined };
  const ids = scope === 'todas' ? [] : parseUnitIds(req.body.unitIds);
  if (scope === 'selecionadas' && !ids.length) return { error: 'Selecione pelo menos uma unidade ou marque todas as unidades' };
  if (ids.length && (await findUnitsByIds(ids)).length !== ids.length) return { error: 'Unidade não encontrada' };
  if (!canPublishToUnits(req.user, ids)) return { error: 'Você só pode publicar manuais nas suas unidades' };
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
  if (!canManageManual(req.user, manual.sector_ids, manual.unit_ids || [])) {
    res.status(403).json({ message: 'Você só pode alterar manuais que sejam apenas dos seus setores e das suas unidades' });
    return null;
  }
  return manual;
}

// Registro de auditoria sem travar a operação quando o banco não estiver disponível (modo demonstração).
const auditManual = (req, action, manual, details = {}) => audit(req.user.id, action, 'manual', manual.id, { titulo: manual.titulo, ...details }).catch(() => {});

/**
 * Apaga do armazenamento os arquivos que saíram do manual, se nenhuma versão arquivada ainda os usa.
 * Roda depois de gravar no banco; uma falha aqui só deixa o arquivo sobrando, sem desfazer a edição.
 */
async function deleteUnusedFiles(values) {
  for (const value of values.filter(Boolean)) {
    try {
      if (!(await isFileReferenced(value))) await deleteStoredFile(value);
    } catch (error) {
      if (!shouldUseDemoStore(error)) console.error('Falha ao apagar arquivo removido do manual', error);
    }
  }
}

// Troca as chaves do bucket por URLs assinadas temporárias; só é chamado depois de conferir o acesso ao manual.
async function withFileUrls(manual) {
  const [pdfUrl, videoUrl] = await Promise.all([resolveFileUrl(manual.pdf_url), resolveFileUrl(manual.video_url)]);
  return { ...manual, pdf_url: pdfUrl, video_url: videoUrl };
}


// Tamanho máximo do título (mesmo de manuals.titulo VARCHAR(180) no schema.sql).
const MAX_TITLE_LENGTH = 180;

/** Texto opcional vindo da tela: só aceita string; vazio vira null. */
const optionalText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Lista os manuais que o usuário pode ler (filtro opcional por sistema em ?systemId=). */
export async function index(req, res) {
  const systemId = Number(req.query.systemId) > 0 ? Number(req.query.systemId) : null;
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

/** Abre um manual (se o usuário tem acesso) com os endereços dos arquivos prontos para o navegador. */
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

/** Cadastra um manual novo (PDF e/ou vídeo, setores, unidades e, se vier, a prova do manual). */
export async function store(req, res) {
  const titulo = optionalText(req.body.titulo);
  const descricao = optionalText(req.body.descricao);
  const systemId = Number(req.body.systemId) > 0 ? Number(req.body.systemId) : null;

  if (!titulo || !systemId) {
    return res.status(400).json({ message: 'Sistema e título são obrigatórios' });
  }
  if (titulo.length > MAX_TITLE_LENGTH) return res.status(400).json({ message: `O título pode ter até ${MAX_TITLE_LENGTH} caracteres` });
  const sectors = await resolveManualSectors(req);
  if (sectors.error) return res.status(400).json({ message: sectors.error });
  const units = await resolveManualUnits(req);
  if (units.error) return res.status(400).json({ message: units.error });
  // O manual pode ter só PDF, só vídeo ou os dois.
  if (!hasFile(req, 'pdf') && !hasFile(req, 'video')) {
    return res.status(400).json({ message: 'Envie pelo menos o PDF ou o vídeo' });
  }
  // Prova do manual (opcional): validada antes de gravar os arquivos para não sobrar upload de um cadastro recusado.
  const { error: examError, exam } = parseManualExam(req.body.exam);
  if (examError) return res.status(400).json({ message: examError });
  // Prova montada a partir de um modelo: o modelo precisa ser do setor de quem cadastra.
  if (exam?.templateId && !canUseTemplate(req.user, await getTemplate(exam.templateId))) {
    return res.status(400).json({ message: 'Modelo de prova não encontrado ou sem permissão' });
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
      unitIds: units.ids,
      criadoPor: req.user.id,
      exam
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
      unitIds: units.ids,
      criadoPor: req.user.id,
      exam
    });
  }

  if (exam) await auditManual(req, 'manual_exam_created', manual, { examId: manual.exam_id, required: exam.required });
  res.status(201).json(manual);
}

/** Edita o manual: dados, setores, unidades, ativo/inativo e troca ou remoção de arquivos. */
export async function update(req, res) {
  const current = await findManageableManual(req, res);
  if (!current) return;
  // undefined = campo não enviado (não muda). Título enviado vazio é recusado; descrição vazia apaga a descrição.
  const titulo = req.body.titulo === undefined ? undefined : optionalText(req.body.titulo);
  const descricao = req.body.descricao === undefined ? undefined : (optionalText(req.body.descricao) ?? '');
  if (titulo === null) return res.status(400).json({ message: 'O título não pode ficar vazio' });
  if (titulo && titulo.length > MAX_TITLE_LENGTH) return res.status(400).json({ message: `O título pode ter até ${MAX_TITLE_LENGTH} caracteres` });
  const active = req.body.active === undefined ? undefined : String(req.body.active) === 'true';
  // Sistema: undefined mantém; um id válido troca. O sistema é obrigatório, então valor inválido é recusado.
  const systemId = req.body.systemId === undefined ? undefined : Number(req.body.systemId) > 0 ? Number(req.body.systemId) : null;
  if (systemId === null) return res.status(400).json({ message: 'Escolha o sistema do manual' });
  // Setores só mudam quando vierem na requisição (sectorIds ou o campo antigo setor).
  const sectors = req.body.sectorIds !== undefined || req.body.setor ? await resolveManualSectors(req) : null;
  if (sectors?.error) return res.status(400).json({ message: sectors.error });
  const units = await resolveManualUnits(req, { isUpdate: true });
  if (units.error) return res.status(400).json({ message: units.error });
  // Remover só vale para o arquivo que o manual tem; não dá para remover e trocar o mesmo arquivo na mesma edição.
  const removePdf = isTrue(req.body.removePdf) && Boolean(current.pdf_url);
  const removeVideo = isTrue(req.body.removeVideo) && Boolean(current.video_url);
  if ((removePdf && hasFile(req, 'pdf')) || (removeVideo && hasFile(req, 'video'))) {
    return res.status(400).json({ message: 'Escolha entre trocar ou remover o arquivo, não os dois' });
  }
  const keepsPdf = hasFile(req, 'pdf') || (Boolean(current.pdf_url) && !removePdf);
  const keepsVideo = hasFile(req, 'video') || (Boolean(current.video_url) && !removeVideo);
  if (!keepsPdf && !keepsVideo) {
    return res.status(400).json({ message: 'O manual precisa ficar com pelo menos o PDF ou o vídeo' });
  }
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
      unitIds: units.ids,
      active,
      removePdf,
      removeVideo
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
      unitIds: units.ids,
      active,
      removePdf,
      removeVideo
    });
  }

  if (!manual) {
    return res.status(404).json({ message: 'Manual nao encontrado' });
  }

  await auditManual(req, 'manual_updated', manual);
  if (removePdf || removeVideo) {
    const removed = [removePdf && 'pdf', removeVideo && 'video'].filter(Boolean);
    await auditManual(req, 'manual_file_removed', manual, { removed });
    await deleteUnusedFiles([removePdf && current.pdf_url, removeVideo && current.video_url]);
  }
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
