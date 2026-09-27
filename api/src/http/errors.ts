import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
export const unprocessable = (message: string) => new AppError(422, message);
export const unauthorized = (message = 'Please sign in') => new AppError(401, message);
export const forbidden = (message = 'Not allowed for your role') => new AppError(403, message);

export function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed id can't match anything, so it is a 404, not a 500 from Postgres. */
export function idParam(value: string, message = 'Not found') {
  if (!UUID.test(value)) throw notFound(message);
  return value;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Invalid input', issues: err.issues });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON' });
    return;
  }
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
};
