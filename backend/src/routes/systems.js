/** Endpoints de sistemas; leitura é autenticada e gravações exigem a permissão de cadastrar sistemas. */
import { Router } from 'express';
import { destroy, index, store, update } from '../controllers/systemController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', authenticate, asyncHandler(index));
router.post('/', authenticate, requirePermission(PERMISSIONS.MANAGE_SYSTEMS), asyncHandler(store));
router.put('/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_SYSTEMS), asyncHandler(update));
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_SYSTEMS), asyncHandler(destroy));

export default router;
