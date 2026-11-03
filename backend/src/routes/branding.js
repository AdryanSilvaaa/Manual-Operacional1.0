/** Aparência (cores e logos): leitura pública, gravação só do suporte. */
import { Router } from 'express';
import { show, update } from '../controllers/brandingController.js';
import { authenticate, requireSupport } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/', asyncHandler(show));
router.put('/', authenticate, requireSupport, asyncHandler(update));
export default router;
