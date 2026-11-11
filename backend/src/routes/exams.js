/** Endpoints de provas; ver resultados exige a permissão de relatórios. */
import { Router } from 'express';
import { available, leave, results, show, start, submit } from '../controllers/examController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/available', authenticate, asyncHandler(available));
router.get('/results', authenticate, requirePermission(PERMISSIONS.VIEW_REPORTS), asyncHandler(results));
router.get('/:id', authenticate, asyncHandler(show));
// Iniciar libera as perguntas; sair da página antes de enviar encerra a prova (leave).
router.post('/:id/start', authenticate, asyncHandler(start));
router.post('/:id/submissions', authenticate, asyncHandler(submit));
router.post('/:id/leave', authenticate, asyncHandler(leave));

export default router;
