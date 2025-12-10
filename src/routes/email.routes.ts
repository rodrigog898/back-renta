
import { Router } from 'express';
import { auth } from '../middleware/auth';
import * as EmailController from '../controllers/email.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { crearRecordatorio } from '../controllers/scheduleemail.controller';

const router = Router();

router.post('/send', auth, asyncHandler(EmailController.sendEmailToMe));

router.get('/status', auth, asyncHandler(EmailController.checkEmailService));

router.post('/recordatorio', auth, asyncHandler(crearRecordatorio));



export default router;