import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { getManualForUser } from '../models/Manual.js';
import { getProgress, getReport, saveProgress } from '../models/Progress.js';

async function ensureManualAccess(manualId, user) {
  try {
    return await getManualForUser(manualId, user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.getManualForUser(manualId, user);
  }
}

export async function show(req, res) {
  const manual = await ensureManualAccess(req.params.manualId, req.user);
  if (!manual) return res.status(404).json({ message: 'Manual nao encontrado ou sem permissao' });

  let progress;
  try {
    progress = await getProgress(req.user.id, req.params.manualId);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    progress = demoStore.getProgress(req.user.id, req.params.manualId);
  }
  res.json(progress || { pdf_completed: false, video_progress: 0, total_seconds: 0, page_count: 0, last_page: 0, pages_viewed: [] });
}

export async function update(req, res) {
  const manual = await ensureManualAccess(req.params.manualId, req.user);
  if (!manual) return res.status(404).json({ message: 'Manual nao encontrado ou sem permissao' });

  const payload = {
    userId: req.user.id,
    manualId: Number(req.params.manualId),
    pdfCompleted: req.body.pdfCompleted,
    videoProgress: req.body.videoProgress,
    seconds: req.body.seconds,
    page: req.body.page,
    pageCount: req.body.pageCount
  };
  let progress;
  try {
    progress = await saveProgress(payload);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    progress = demoStore.saveProgress(payload);
  }
  res.json(progress);
}

export async function report(req, res) {
  let rows;
  try {
    rows = await getReport(req.user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    rows = demoStore.getProgressReport(req.user);
  }
  res.json(rows);
}
