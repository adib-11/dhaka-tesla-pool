import { prisma } from '../db';
import { unauthorized } from '../http/errors';

export const zoneView = (z: { id: number; name: string }) => ({ id: z.id, name: z.name });

export async function meView(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { tesla: true } });
  // A valid cookie can outlive the user row (seed reset, account deleted): that is a 401, not a 500.
  if (!u) throw unauthorized('Session expired, please sign in again');
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    teslapayBalancePaisa: u.teslapayBalancePaisa,
    tesla: u.tesla && {
      id: u.tesla.id,
      name: u.tesla.name,
      plate: u.tesla.plate,
      capacity: u.tesla.capacity,
      isOnline: u.tesla.isOnline,
      currentZoneId: u.tesla.currentZoneId,
    },
  };
}
