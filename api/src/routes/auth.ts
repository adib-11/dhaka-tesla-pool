import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { prisma } from '../db';
import { endSession, requireAuth, startSession } from '../http/auth';
import { conflict, isUniqueViolation, unauthorized } from '../http/errors';
import { meView } from '../services/views';

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});
const Signup = Credentials.extend({ name: z.string().trim().min(1).max(80) });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
});

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const authRouter = Router();

/** New Passengers start with this much TeslaPay, recorded as a single ledger row. */
export const WELCOME_CREDIT_PAISA = 50_000; // ৳500

authRouter.post('/signup', authLimiter, async (req, res) => {
  const body = Signup.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma
    .$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: body.name, email: body.email, passwordHash, role: 'PASSENGER', teslapayBalancePaisa: WELCOME_CREDIT_PAISA },
      });
      await tx.teslapayTransaction.create({
        data: { userId: created.id, type: 'TOP_UP', amountPaisa: WELCOME_CREDIT_PAISA, balanceAfterPaisa: WELCOME_CREDIT_PAISA },
      });
      return created;
    })
    .catch((err) => {
      throw isUniqueViolation(err) ? conflict('That email is already registered') : err;
    });
  startSession(res, user);
  res.status(201).json(await meView(user.id));
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const body = Credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const ok = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Wrong email or password');
  startSession(res, user);
  res.json(await meView(user.id));
});

authRouter.post('/logout', (_req, res) => {
  endSession(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await meView(req.user!.id));
});
