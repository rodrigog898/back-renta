import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.post('/register', asyncHandler(AuthController.register));
router.post('/login', asyncHandler(AuthController.login));
router.post('/refresh', asyncHandler(AuthController.refresh));

export default router;
