/** Endpoints de manuais; a ordem dos middlewares define autenticação, permissão e upload. */
import { Router } from 'express';
import { destroy, index, manage, show, store, update } from '../controllers/manualController.js';
import { authenticate, requireManualManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadManualFiles } from '../middleware/upload.js';

const router = Router();

router.get('/', authenticate, asyncHandler(index));
// Antes de /:id para "manage" não ser lido como id.
router.get('/manage', authenticate, requireManualManager, asyncHandler(manage));
router.get('/:id', authenticate, asyncHandler(show));
router.post('/', authenticate, requireManualManager, uploadManualFiles, asyncHandler(store));
// Editar e excluir: suporte, editor de conteúdo e gerente de setor (este só nos manuais dos seus setores).
router.put('/:id', authenticate, requireManualManager, uploadManualFiles, asyncHandler(update));
router.delete('/:id', authenticate, requireManualManager, asyncHandler(destroy));

export default router;
