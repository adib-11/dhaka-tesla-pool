import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { MAX_SEATS_PER_REQUEST } from '../domain/fare';
import { estimateRide } from '../services/passenger';

const EstimateQuery = z.object({
  from: z.coerce.number().int(),
  to: z.coerce.number().int(),
  seats: z.coerce.number().int().min(1).max(MAX_SEATS_PER_REQUEST).default(1),
});

export const catalogRouter = Router();

catalogRouter.get('/zones', async (_req, res) => {
  res.json(await prisma.zone.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }));
});

catalogRouter.get('/fare-estimate', async (req, res) => {
  const q = EstimateQuery.parse(req.query);
  res.json(await estimateRide(q.from, q.to, q.seats));
});
