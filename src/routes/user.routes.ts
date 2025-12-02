
import { Router } from 'express';
import { me, updateMe } from '../controllers/user.controller';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
router.get('/me', auth, asyncHandler(me));
router.patch('/me', auth, asyncHandler(updateMe));

export default router;
