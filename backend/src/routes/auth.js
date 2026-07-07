import { Router } from 'express';
import { login, me, registerManagerUser } from '../controllers/authController.js';
import { authenticate, requireManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/login', asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));
router.post('/register', authenticate, requireManager, asyncHandler(registerManagerUser));

export default router;
