/** Upload direto de PDF e vídeo ao bucket (modo s3). */
import { Router } from 'express';
import { config, presign } from '../controllers/uploadController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/config', authenticate, requirePermission(PERMISSIONS.PUBLISH_CONTENT), config);
router.post('/presign', authenticate, requirePermission(PERMISSIONS.PUBLISH_CONTENT), asyncHandler(presign));
export default router;
