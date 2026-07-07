import { Router } from 'express';
import { destroy, index } from '../controllers/userController.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', authenticate, requireManager, asyncHandler(index));
router.delete('/:id', authenticate, requireManager, asyncHandler(destroy));

export default router;
