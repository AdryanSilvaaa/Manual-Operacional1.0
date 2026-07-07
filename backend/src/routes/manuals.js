import { Router } from 'express';
import { destroy, index, show, store, update } from '../controllers/manualController.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadManualFiles } from '../middleware/upload.js';

const router = Router();

router.get('/', authenticate, asyncHandler(index));
router.get('/:id', authenticate, asyncHandler(show));
router.post('/', authenticate, requireManager, uploadManualFiles, asyncHandler(store));
router.put('/:id', authenticate, requireManager, uploadManualFiles, asyncHandler(update));
router.delete('/:id', authenticate, requireManager, asyncHandler(destroy));

export default router;
