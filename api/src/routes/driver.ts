import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../http/auth';
import { idParam } from '../http/errors';
import { acceptRideRequest, getActiveTrip, listCompatibleRequests, setDriverStatus } from '../services/driver';

const DriverStatus = z.object({ isOnline: z.boolean(), currentZoneId: z.number().int() });

export const driverRouter = Router();
driverRouter.use(requireAuth, requireRole('DRIVER'));

driverRouter.patch('/status', async (req, res) => {
  res.json(await setDriverStatus(req.user!.id, DriverStatus.parse(req.body)));
});

driverRouter.get('/trip', async (req, res) => {
  res.json(await getActiveTrip(req.user!.id));
});

driverRouter.get('/requests', async (req, res) => {
  res.json(await listCompatibleRequests(req.user!.id));
});

driverRouter.post('/requests/:id/accept', async (req, res) => {
  res.json(await acceptRideRequest(req.user!.id, idParam(req.params.id, 'Ride request not found')));
});
