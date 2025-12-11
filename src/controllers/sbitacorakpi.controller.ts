import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import * as DashboardService from '../services/kpicard.service';


export async function getKPIs(req: AuthedRequest, res: Response) {
  const kpis = await DashboardService.getKPIs(req);
  res.json(kpis);
}

