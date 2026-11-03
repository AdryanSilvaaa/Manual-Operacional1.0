/** Upload direto de PDF e vídeo ao bucket (modo s3). */
import { Router } from 'express';
import { config, presign } from '../controllers/uploadController.js';
import { authenticate, requireManualManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/config', authenticate, requireManualManager, config);
router.post('/presign', authenticate, requireManualManager, asyncHandler(presign));
export default router;
