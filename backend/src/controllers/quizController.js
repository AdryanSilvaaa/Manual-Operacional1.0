import { getManualForUser } from '../models/Manual.js';
import { listQuestions, submitAttempt } from '../models/Quiz.js';
import { saveProgress } from '../models/Progress.js';

export async function index(req, res) {
  const manual = await getManualForUser(req.params.manualId, req.user);
  if (!manual) return res.status(404).json({ message: 'Manual não encontrado' });
  res.json(await listQuestions(req.params.manualId));
}

export async function submit(req, res) {
  const manual = await getManualForUser(req.params.manualId, req.user);
  if (!manual) return res.status(404).json({ message: 'Manual não encontrado' });
  const result = await submitAttempt(req.user.id, req.params.manualId, req.body.answers || {});
  if (result.passed) await saveProgress({ userId: req.user.id, manualId: Number(req.params.manualId) });
  res.json(result);
}
