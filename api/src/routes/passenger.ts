import { Router } from 'express';
import { z } from 'zod';
import { MAX_SEATS_PER_REQUEST } from '../domain/fare';
import { requireAuth, requireRole } from '../http/auth';
import { idParam } from '../http/errors';
import { cancelRideRequest, createRideRequest, getPassengerRide, listPassengerRides } from '../services/passenger';

const NewRide = z.object({
  pickupZoneId: z.number().int(),
  dropoffZoneId: z.number().int(),
  seats: z.number().int().min(1).max(MAX_SEATS_PER_REQUEST).default(1),
  allowSharing: z.boolean().default(true),
  paymentMethod: z.enum(['CASH', 'TESLAPAY']).default('CASH'),
});

export const passengerRouter = Router();
passengerRouter.use(requireAuth, requireRole('PASSENGER'));

passengerRouter.post('/', async (req, res) => {
  res.status(201).json(await createRideRequest(req.user!.id, NewRide.parse(req.body)));
});

passengerRouter.get('/', async (req, res) => {
  res.json(await listPassengerRides(req.user!.id));
});

passengerRouter.get('/:id', async (req, res) => {
  res.json(await getPassengerRide(req.user!.id, idParam(req.params.id, 'Ride not found')));
});

passengerRouter.post('/:id/cancel', async (req, res) => {
  res.json(await cancelRideRequest(req.user!.id, idParam(req.params.id, 'Ride not found')));
});
