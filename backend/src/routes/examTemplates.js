/** Endpoints dos modelos de prova; todos exigem a permissão de publicar conteúdo. */
import { Router } from 'express';
import { apply, collaborators, destroy, index, show, store, update } from '../controllers/examTemplateController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(authenticate, requirePermission(PERMISSIONS.PUBLISH_CONTENT));
router.get('/', asyncHandler(index));
router.post('/', asyncHandler(store));
router.get('/:id', asyncHandler(show));
router.put('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(destroy));
router.get('/:id/collaborators', asyncHandler(collaborators));
// Aplicar cria uma prova nova a partir do modelo (colaboradores escolhidos ou o setor todo).
router.post('/:id/apply', asyncHandler(apply));

export default router;
