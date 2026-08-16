import { Router } from 'express';
import { index, submit } from '../controllers/quizController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
const router = Router();
router.get('/:manualId', authenticate, asyncHandler(index));
router.post('/:manualId/attempts', authenticate, asyncHandler(submit));
export default router;
