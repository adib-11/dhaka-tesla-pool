import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config';
import { forbidden, unauthorized } from './errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

const COOKIE = 'token';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function startSession(res: Response, user: { id: string; role: Role }) {
  const token = jwt.sign({ role: user.role }, config.JWT_SECRET, { subject: user.id, expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.COOKIE_SECURE, maxAge: WEEK_MS });
}

export function endSession(res: Response) {
  res.clearCookie(COOKIE);
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw unauthorized();
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    req.user = { id: payload.sub!, role: payload.role };
  } catch {
    throw unauthorized('Session expired, please sign in again');
  }
  next();
};

export const requireRole =
  (role: Role): RequestHandler =>
  (req, _res, next) => {
    if (req.user?.role !== role) throw forbidden();
    next();
  };
