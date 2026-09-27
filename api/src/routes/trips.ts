import { Router } from 'express';
import { requireAuth, requireRole } from '../http/auth';
import { idParam } from '../http/errors';
import { arriveAtPickup, cancelTrip, dropOff, getDriverTrip, listDriverTrips, startTrip } from '../services/driver';

export const tripsRouter = Router();
tripsRouter.use(requireAuth, requireRole('DRIVER'));

const tripId = (value: string) => idParam(value, 'Trip not found');

tripsRouter.get('/', async (req, res) => {
  res.json(await listDriverTrips(req.user!.id));
});

tripsRouter.get('/:id', async (req, res) => {
  res.json(await getDriverTrip(req.user!.id, tripId(req.params.id)));
});

tripsRouter.post('/:id/arrive', async (req, res) => {
  res.json(await arriveAtPickup(req.user!.id, tripId(req.params.id)));
});

tripsRouter.post('/:id/start', async (req, res) => {
  res.json(await startTrip(req.user!.id, tripId(req.params.id)));
});

tripsRouter.post('/:id/cancel', async (req, res) => {
  res.json(await cancelTrip(req.user!.id, tripId(req.params.id)));
});

tripsRouter.post('/:id/requests/:requestId/drop-off', async (req, res) => {
  res.json(await dropOff(req.user!.id, tripId(req.params.id), idParam(req.params.requestId, 'Passenger is not on this trip')));
});
