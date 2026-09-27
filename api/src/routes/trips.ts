import { Router } from 'express';
import { requireAuth, requireRole } from '../http/auth';
import { idParam } from '../http/errors';
import { getDriverTrip, listDriverTrips } from '../services/driver';

export const tripsRouter = Router();
tripsRouter.use(requireAuth, requireRole('DRIVER'));

tripsRouter.get('/', async (req, res) => {
  res.json(await listDriverTrips(req.user!.id));
});

tripsRouter.get('/:id', async (req, res) => {
  res.json(await getDriverTrip(req.user!.id, idParam(req.params.id, 'Trip not found')));
});
