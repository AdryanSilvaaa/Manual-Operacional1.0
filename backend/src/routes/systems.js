import { Router } from 'express';
import { destroy, index, store, update } from '../controllers/systemController.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', authenticate, asyncHandler(index));
router.post('/', authenticate, requireManager, asyncHandler(store));
router.put('/:id', authenticate, requireManager, asyncHandler(update));
router.delete('/:id', authenticate, requireManager, asyncHandler(destroy));

export default router;
