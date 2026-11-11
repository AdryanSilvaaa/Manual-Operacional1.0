/** Aparência (cores e logos): leitura pública, gravação só do admin. */
import { Router } from 'express';
import { show, update } from '../controllers/brandingController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/', asyncHandler(show));
router.put('/', authenticate, requirePermission(PERMISSIONS.MANAGE_BRANDING), asyncHandler(update));
export default router;
