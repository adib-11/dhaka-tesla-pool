import { Router } from 'express';
import { requireAuth, requireRole } from '../http/auth';
import { getTeslapayLedger } from '../services/payments';

export const teslapayRouter = Router();
teslapayRouter.use(requireAuth, requireRole('PASSENGER'));

teslapayRouter.get('/', async (req, res) => {
  res.json(await getTeslapayLedger(req.user!.id));
});
