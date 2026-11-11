/** Endpoints de unidades; a lista serve às telas de cadastro, publicação e painel. */
import { Router } from 'express';
import { destroy, index, store, update } from '../controllers/unitController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_UNITS, PERMISSIONS.PUBLISH_CONTENT, PERMISSIONS.VIEW_REPORTS), asyncHandler(index));
router.post('/', authenticate, requirePermission(PERMISSIONS.MANAGE_UNITS), asyncHandler(store));
router.put('/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_UNITS), asyncHandler(update));
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.MANAGE_UNITS), asyncHandler(destroy));
export default router;
