/** Endpoints de manuais; a ordem dos middlewares define autenticação, permissão e upload. */
import { Router } from 'express';
import { destroy, index, manage, show, store, update } from '../controllers/manualController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../utils/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadManualFiles } from '../middleware/upload.js';

const router = Router();

router.get('/', authenticate, asyncHandler(index));
// Antes de /:id para "manage" não ser lido como id.
router.get('/manage', authenticate, requirePermission(PERMISSIONS.PUBLISH_CONTENT), asyncHandler(manage));
router.get('/:id', authenticate, asyncHandler(show));
router.post('/', authenticate, requirePermission(PERMISSIONS.PUBLISH_CONTENT), uploadManualFiles, asyncHandler(store));
// Editar e excluir: quem publica conteúdo (o gerente de setor só nos manuais dos seus setores).
router.put('/:id', authenticate, requirePermission(PERMISSIONS.PUBLISH_CONTENT), uploadManualFiles, asyncHandler(update));
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.PUBLISH_CONTENT), asyncHandler(destroy));

export default router;
