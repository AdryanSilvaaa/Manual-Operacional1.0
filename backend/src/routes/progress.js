/**
 * Rotas /api/progress. Todas exigem login; o relatório exige a permissão VIEW_REPORTS (Painel de uso).
 * A rota /report vem antes de /:manualId para não ser confundida com um id de manual.
 */
import { Router } from 'express';
import { report, show, update } from '../controllers/progressController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/report', authenticate, requirePermission(PERMISSIONS.VIEW_REPORTS), asyncHandler(report));
router.get('/:manualId', authenticate, asyncHandler(show));
router.put('/:manualId', authenticate, asyncHandler(update));
export default router;
