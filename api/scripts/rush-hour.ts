/**
 * Re-enacts 8:41 AM in Banani against a running API:
 * Rafiq books 2 seats, then Nusrat and Shirin race for Bullet's last seat.
 * Usage: API_URL=http://localhost:4000 npm run demo:rush-hour  (needs no active rides for the cast)
 */
import { CAST, DEMO_PASSWORD } from '../prisma/seed-data';

const API = process.env.API_URL ?? 'http://localhost:4000';

async function login(who: keyof typeof CAST) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: CAST[who].email, password: DEMO_PASSWORD }),
  });
  if (!res.ok) throw new Error(`${who} could not sign in: ${res.status}`);
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  return async (path: string, body?: unknown) => {
    const r = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
}

async function main() {
  const [rafiq, nusrat, shirin, jashimPhone, jashimTablet] = await Promise.all([
    login('rafiq'),
    login('nusrat'),
    login('shirin'),
    login('jashim'),
    login('jashim'),
  ]);
  const zones: { id: number; name: string }[] = (await rafiq('/zones')).body;
  const id = (name: string) => zones.find((z) => z.name === name)!.id;

  const r = await rafiq('/ride-requests', { pickupZoneId: id('Banani'), dropoffZoneId: id('Gulshan 1'), seats: 2 });
  console.log('8:41 Rafiq books 2 seats to Gulshan 1:', r.status);
  const accepted = await jashimPhone(`/driver/requests/${r.body.id}/accept`, {});
  console.log('8:42 Jashim accepts. Bullet seats:', `${accepted.body.seatsTaken}/${accepted.body.capacity}`);

  const n = await nusrat('/ride-requests', { pickupZoneId: id('Banani'), dropoffZoneId: id('Mohakhali') });
  const s = await shirin('/ride-requests', { pickupZoneId: id('Banani'), dropoffZoneId: id('Gulshan 2') });
  console.log('8:43 Nusrat and Shirin both want the last seat. Jashim taps Accept on two devices at once…');

  const [a, b] = await Promise.all([
    jashimPhone(`/driver/requests/${n.body.id}/accept`, {}),
    jashimTablet(`/driver/requests/${s.body.id}/accept`, {}),
  ]);
  console.log('  Nusrat accept:', a.status, a.body?.error ?? 'seated');
  console.log('  Shirin accept:', b.status, b.body?.error ?? 'seated');
  const trip = (await jashimPhone('/driver/trip')).body;
  console.log(`Bullet ends at ${trip.seatsTaken}/${trip.capacity}. Never more.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
