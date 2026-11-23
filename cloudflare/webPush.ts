import { generateRequestDetails, generateVAPIDKeys } from 'web-push';
import { z } from 'zod';
import type { D1Database } from './worker';

const endpointSchema = z.url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && (
    url.hostname === 'fcm.googleapis.com' ||
    url.hostname.endsWith('.push.services.mozilla.com') || url.hostname === 'push.services.mozilla.com' ||
    url.hostname.endsWith('.push.apple.com') ||
    url.hostname.endsWith('.notify.windows.com') || url.hostname.endsWith('.wns.windows.com')
  );
});

export const pushEndpointSchema = z.object({ endpoint: endpointSchema });
export const pushSubscriptionSchema = pushEndpointSchema.extend({
  keys: z.object({ p256dh: z.base64url().length(87), auth: z.base64url().length(22) }),
});

export async function getPushKeys(db: D1Database) {
  const select = db.prepare('SELECT public_key AS publicKey, private_key AS privateKey FROM web_push_keys WHERE id = ?').bind('default');
  const keys = await select.first<{ publicKey: string; privateKey: string }>();
  if (keys) return keys;

  const generated = generateVAPIDKeys();
  await db.prepare('INSERT OR IGNORE INTO web_push_keys (id, public_key, private_key) VALUES (?, ?, ?)')
    .bind('default', generated.publicKey, generated.privateKey).run();
  return (await select.first<typeof generated>())!;
}

export async function sendFeePush(db: D1Database, today: string, count: number) {
  if (!count) return;
  const subscriptions = (await db.prepare(`
    SELECT endpoint, p256dh, auth FROM web_push_subscriptions
    WHERE last_sent_date IS NULL OR last_sent_date < ?
  `).bind(today).all<{ endpoint: string; p256dh: string; auth: string }>()).results;
  if (subscriptions.length === 0) return;

  const keys = await getPushKeys(db);
  const payload = JSON.stringify({
    title: 'Tuition fees due tomorrow',
    body: `Open Tuitio to review ${count} payment reminder${count === 1 ? '' : 's'}.`,
    tag: `tuitio-fees-${today}`,
  });
  const deliveries = await Promise.allSettled(subscriptions.map(async ({ endpoint, p256dh, auth }) => {
    const request = generateRequestDetails({ endpoint, keys: { p256dh, auth } }, payload, {
      TTL: 8 * 60 * 60,
      urgency: 'normal',
      vapidDetails: { ...keys, subject: 'https://github.com/VadlaHemanth/Tuitio' },
    });
    const response = await fetch(request.endpoint, {
      method: 'POST',
      headers: request.headers as Record<string, string>,
      body: new Uint8Array(request.body),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    await response.body?.cancel();
    if (response.status === 404 || response.status === 410) {
      await db.prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ? AND auth = ?').bind(endpoint, auth).run();
    } else if (response.ok) {
      await db.prepare('UPDATE web_push_subscriptions SET last_sent_date = ? WHERE endpoint = ? AND auth = ?')
        .bind(today, endpoint, auth).run();
    } else {
      throw new Error(`Push service returned ${response.status}`);
    }
  }));
  for (const delivery of deliveries) {
    if (delivery.status === 'rejected') console.error('Fee push delivery failed', delivery.reason instanceof Error ? delivery.reason.name : 'Unknown error');
  }
}
