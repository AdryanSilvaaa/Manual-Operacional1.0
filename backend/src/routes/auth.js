/** Endpoints de sessão; altere caminhos/middlewares aqui e a lógica em authController.js. */
import { Router } from 'express';
import { login, me, registerManagerUser } from '../controllers/authController.js';
import { authenticate, requireSupport } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/login', asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));
router.post('/register', authenticate, requireSupport, asyncHandler(registerManagerUser));

export default router;
