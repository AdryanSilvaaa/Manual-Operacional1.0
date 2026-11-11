/**
 * Rotas de progresso (/api/progress): ler e salvar o progresso do colaborador em um manual e o relatório do Painel.
 * Sempre confere antes se a pessoa pode ver o manual (setor/unidade); sem acesso responde 404.
 */
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { getManualForUser } from '../models/Manual.js';
import { getProgress, getReport, saveProgress } from '../models/Progress.js';

// Devolve o manual se o usuário pode vê-lo (ou null). No modo demonstração usa os dados em memória.
async function ensureManualAccess(manualId, user) {
  try {
    return await getManualForUser(manualId, user);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    return demoStore.getManualForUser(manualId, user);
  }
}

// GET /api/progress/:manualId — progresso atual (ou zerado, se a pessoa nunca abriu o manual).
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

// PUT /api/progress/:manualId — registra página vista, % de vídeo e tempo. A conclusão é calculada no banco.
export async function update(req, res) {
  const manual = await ensureManualAccess(req.params.manualId, req.user);
  if (!manual) return res.status(404).json({ message: 'Manual nao encontrado ou sem permissao' });

  const payload = {
    userId: req.user.id,
    manualId: Number(req.params.manualId),
    videoProgress: req.body?.videoProgress,
    seconds: req.body?.seconds,
    page: req.body?.page,
    pageCount: req.body?.pageCount,
    hasPdf: Boolean(manual.pdf_url),
    hasVideo: Boolean(manual.video_url)
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

// GET /api/progress/report — linhas do Painel de uso, já filtradas pelos setores/unidades de quem pede.
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
