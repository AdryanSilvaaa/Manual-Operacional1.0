import { Router } from 'express';
import { destroy, index, store, update } from '../controllers/systemController.js';
import { authenticate, requireSupport } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', authenticate, asyncHandler(index));
router.post('/', authenticate, requireSupport, asyncHandler(store));
router.put('/:id', authenticate, requireSupport, asyncHandler(update));
router.delete('/:id', authenticate, requireSupport, asyncHandler(destroy));

export default router;
