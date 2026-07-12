import {
  createManual,
  deleteManual,
  getManualForUser,
  listManualsForUser,
  replaceManualPermissions,
  updateManual
} from '../models/Manual.js';
import { uploadFile } from '../config/storage.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';

function parseAllowedUsers(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(Number).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((id) => Number(id.trim()))
    .filter(Boolean);
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
  const { titulo, descricao } = req.body;
  const systemId = req.body.systemId ? Number(req.body.systemId) : null;

  if (!titulo || !systemId || !req.files?.pdf?.[0] || !req.files?.video?.[0]) {
    return res.status(400).json({ message: 'Sistema, titulo, PDF e video sao obrigatorios' });
  }

  const pdfUrl = await uploadFile(req.files.pdf[0], 'pdfs');
  const videoUrl = await uploadFile(req.files.video[0], 'videos');

  let manual;
  try {
    manual = await createManual({
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId,
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
      criadoPor: req.user.id
    });
  }

  const allowedUsers = parseAllowedUsers(req.body.allowedUsers);
  try {
    await replaceManualPermissions(manual.id, allowedUsers);
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    demoStore.replaceManualPermissions(manual.id, allowedUsers);
  }

  res.status(201).json(manual);
}

export async function update(req, res) {
  const { titulo, descricao } = req.body;
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

  let manual;
  try {
    manual = await updateManual(req.params.id, {
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId
    });
  } catch (error) {
    if (!shouldUseDemoStore(error)) {
      throw error;
    }

    manual = demoStore.updateManual(req.params.id, {
      titulo,
      descricao,
      pdfUrl,
      videoUrl,
      systemId
    });
  }

  if (!manual) {
    return res.status(404).json({ message: 'Manual nao encontrado' });
  }

  if (req.body.allowedUsers !== undefined) {
    const allowedUsers = parseAllowedUsers(req.body.allowedUsers);
    try {
      await replaceManualPermissions(manual.id, allowedUsers);
    } catch (error) {
      if (!shouldUseDemoStore(error)) {
        throw error;
      }

      demoStore.replaceManualPermissions(manual.id, allowedUsers);
    }
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
