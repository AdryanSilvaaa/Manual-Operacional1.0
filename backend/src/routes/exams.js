/** Endpoints de provas; criar e ver resultados exige gerente de setor ou suporte. */
import { Router } from 'express';
import { available, results, show, store, submit } from '../controllers/examController.js';
import { authenticate, requireManualManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/', authenticate, requireManualManager, asyncHandler(store));
router.get('/available', authenticate, asyncHandler(available));
router.get('/results', authenticate, requireManualManager, asyncHandler(results));
router.get('/:id', authenticate, asyncHandler(show));
router.post('/:id/submissions', authenticate, asyncHandler(submit));

export default router;
