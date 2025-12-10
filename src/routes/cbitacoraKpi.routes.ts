import { Router } from "express";
import { auth } from '../middleware/auth';
import * as BitacoraKPIController from "../controllers/sbitacorakpi.controller";
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get("/bitacorakpi", auth, asyncHandler(BitacoraKPIController.getKPIs));
export default router;


