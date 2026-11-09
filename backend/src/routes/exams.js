/** Endpoints de provas; criar e ver resultados exige gerente de setor ou suporte. */
import { Router } from 'express';
import { available, collaborators, leave, results, show, start, store, submit } from '../controllers/examController.js';
import { authenticate, requireManualManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/', authenticate, requireManualManager, asyncHandler(store));
router.get('/available', authenticate, asyncHandler(available));
router.get('/results', authenticate, requireManualManager, asyncHandler(results));
router.get('/collaborators', authenticate, requireManualManager, asyncHandler(collaborators));
router.get('/:id', authenticate, asyncHandler(show));
// Iniciar libera as perguntas; sair da página antes de enviar encerra a prova (leave).
router.post('/:id/start', authenticate, asyncHandler(start));
router.post('/:id/submissions', authenticate, asyncHandler(submit));
router.post('/:id/leave', authenticate, asyncHandler(leave));

export default router;
