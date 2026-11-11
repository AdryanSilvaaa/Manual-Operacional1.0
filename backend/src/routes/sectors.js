/** Endpoints de setores; a lista serve às telas de cadastro, publicação e painel. */
import { Router } from 'express';
import { index, store } from '../controllers/sectorController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/', authenticate, requirePermission(PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_SECTORS, PERMISSIONS.PUBLISH_CONTENT, PERMISSIONS.VIEW_REPORTS), asyncHandler(index));
router.post('/', authenticate, requirePermission(PERMISSIONS.MANAGE_SECTORS), asyncHandler(store));
export default router;
