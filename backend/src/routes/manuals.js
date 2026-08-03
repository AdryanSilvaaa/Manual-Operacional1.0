/** Endpoints de manuais; a ordem dos middlewares define autenticação, permissão e upload. */
import { Router } from 'express';
import { destroy, index, show, store, update } from '../controllers/manualController.js';
import { authenticate, requireManualManager, requireSupport } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadManualFiles } from '../middleware/upload.js';

const router = Router();

router.get('/', authenticate, asyncHandler(index));
router.get('/:id', authenticate, asyncHandler(show));
router.post('/', authenticate, requireManualManager, uploadManualFiles, asyncHandler(store));
router.put('/:id', authenticate, requireSupport, uploadManualFiles, asyncHandler(update));
router.delete('/:id', authenticate, requireSupport, asyncHandler(destroy));

export default router;
