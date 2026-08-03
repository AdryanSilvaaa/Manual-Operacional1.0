/** Endpoints de setores; mudar requireSupport/requireManualManager altera quem pode operá-los. */
import { Router } from 'express';
import { index, store } from '../controllers/sectorController.js';
import { authenticate, requireManualManager, requireSupport } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/', authenticate, requireManualManager, asyncHandler(index));
router.post('/', authenticate, requireSupport, asyncHandler(store));
export default router;
