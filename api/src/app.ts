import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from './config';
import { prisma } from './db';
import { errorHandler } from './http/errors';
import { authRouter } from './routes/auth';
import { catalogRouter } from './routes/catalog';
import { driverRouter } from './routes/driver';
import { passengerRouter } from './routes/passenger';
import { tripsRouter } from './routes/trips';

export const logger = pino({ enabled: config.NODE_ENV !== 'test' });

export function buildApp() {
  const app = express();
  // Trusts one proxy hop (Render). Vercel -> Render adds a second hop, so rate-limit
  // keys may group users behind the same Vercel edge; set the real hop count once measured.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  // Zones and the fare estimate are readable by anyone: the passenger pages gate on a session.
  app.use(catalogRouter);
  app.use('/ride-requests', passengerRouter);
  app.use('/driver', driverRouter);
  app.use('/trips', tripsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
  app.use(errorHandler);
  return app;
}
