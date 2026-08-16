import { Router } from 'express';
import { report, show, update } from '../controllers/progressController.js';
import { authenticate, requireManualManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.get('/report', authenticate, requireManualManager, asyncHandler(report));
router.get('/:manualId', authenticate, asyncHandler(show));
router.put('/:manualId', authenticate, asyncHandler(update));
export default router;
