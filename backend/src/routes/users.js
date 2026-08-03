/** Endpoints administrativos de usuários; todos exigem o perfil de suporte. */
import { Router } from 'express';
import { destroy, index, update } from '../controllers/userController.js';
import { authenticate, requireSupport } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', authenticate, requireSupport, asyncHandler(index));
router.put('/:id', authenticate, requireSupport, asyncHandler(update));
router.delete('/:id', authenticate, requireSupport, asyncHandler(destroy));

export default router;
