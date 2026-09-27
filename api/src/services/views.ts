import { prisma } from '../db';

export const zoneView = (z: { id: number; name: string }) => ({ id: z.id, name: z.name });

export async function meView(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { tesla: true } });
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
