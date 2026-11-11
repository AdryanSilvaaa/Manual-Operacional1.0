/** Endpoints administrativos de usuários; todos exigem a permissão de cadastrar usuários (admin ou administrador de cadastros). */
import { Router } from 'express';
import { destroy, importUsers, index, update } from '../controllers/userController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(index));
router.post('/import', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(importUsers));
router.put('/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(update));
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(destroy));

export default router;
