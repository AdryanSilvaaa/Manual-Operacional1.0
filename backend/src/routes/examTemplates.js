/** Endpoints dos modelos de prova; todos exigem gerente de setor, editor de conteúdo ou suporte. */
import { Router } from 'express';
import { apply, collaborators, destroy, index, show, store, update } from '../controllers/examTemplateController.js';
import { authenticate, requireManualManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(authenticate, requireManualManager);
router.get('/', asyncHandler(index));
router.post('/', asyncHandler(store));
router.get('/:id', asyncHandler(show));
router.put('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(destroy));
router.get('/:id/collaborators', asyncHandler(collaborators));
// Aplicar cria uma prova nova a partir do modelo (colaboradores escolhidos ou o setor todo).
router.post('/:id/apply', asyncHandler(apply));

export default router;
