/**
 * Orquestra listagem, upload, edição e exclusão de manuais.
 * Altere validações/ respostas aqui; acesso ao banco em models/Manual.js e arquivos em config/storage.js.
 */
import {
  createManual,
  deleteManual,
  getManualForUser,
  listManualsForUser,
  updateManual,
  archiveAndUpdateManual
} from '../models/Manual.js';
import { uploadFile } from '../config/storage.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { findOrCreateSector, findSectorsByIds } from '../models/Sector.js';


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

  res.json(manual);
}

export async function store(req, res) {
  const { titulo, descricao, setor } = req.body;
  const systemId = req.body.systemId ? Number(req.body.systemId) : null;

  // Gerente de setor so publica em um dos seus setores, mesmo que o formulario seja alterado.
  let sectorName = setor;
  if (req.user.role === 'gerente_setor') {
    const ownSectors = await findSectorsByIds(req.user.sector_ids || []);
    const chosen = setor
      ? ownSectors.find((item) => item.nome.toLowerCase() === String(setor).trim().toLowerCase())
      : ownSectors.length === 1 ? ownSectors[0] : null;
    if (!chosen) return res.status(400).json({ message: 'Escolha um dos seus setores' });
    sectorName = chosen.nome;
  }

  if (!titulo || !sectorName || !systemId || !req.files?.pdf?.[0] || !req.files?.video?.[0]) {
    return res.status(400).json({ message: 'Setor, sistema, titulo, PDF e video sao obrigatorios' });
  }

  const pdfUrl = await uploadFile(req.files.pdf[0], 'pdfs');
  const videoUrl = await uploadFile(req.files.video[0], 'videos');
  const sector = await findOrCreateSector(sectorName);

  let manual;
  try {
    manual = await createManual({
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId,
      sectorId: sector.id,
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
      sectorId: sector.id,
      criadoPor: req.user.id
    });
  }

  res.status(201).json(manual);
}

export async function update(req, res) {
  const { titulo, descricao, setor } = req.body;
  const active = req.body.active === undefined ? undefined : String(req.body.active) === 'true';
  const systemId = req.body.systemId === undefined
    ? undefined
    : req.body.systemId
      ? Number(req.body.systemId)
      : null;
  const pdfUrl = req.files?.pdf?.[0]
    ? await uploadFile(req.files.pdf[0], 'pdfs')
    : null;
  const videoUrl = req.files?.video?.[0]
    ? await uploadFile(req.files.video[0], 'videos')
    : null;
  const sector = setor ? await findOrCreateSector(setor) : null;

  let manual;
  try {
    const updateData = {
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId,
      sectorId: sector?.id,
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
      sectorId: sector?.id
    });
  }

  if (!manual) {
    return res.status(404).json({ message: 'Manual nao encontrado' });
  }

  res.json(manual);
}

export async function destroy(req, res) {
  try {
    await deleteManual(req.params.id);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    demoStore.deleteManual(req.params.id);
  }

  res.status(204).send();
}
