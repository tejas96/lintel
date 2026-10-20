import type { TestApp } from './test-app';

/** A tiny authenticated client for journey tests: `as(token).get(path)` etc. */
export function client(testApp: TestApp, token: string) {
  const auth = { authorization: `Bearer ${token}` };
  return {
    get: (path: string) => testApp.http.get(path).set(auth),
    post: (path: string, body: object = {}) => testApp.http.post(path).set(auth).send(body),
    put: (path: string, body: object = {}) => testApp.http.put(path).set(auth).send(body),
    patch: (path: string, body: object = {}) => testApp.http.patch(path).set(auth).send(body),
    upload: (path: string, file: Buffer, name: string, fields: Record<string, string> = {}) => {
      let request = testApp.http.post(path).set(auth).attach('file', file, name);
      for (const [key, value] of Object.entries(fields)) request = request.field(key, value);
      return request;
    },
  };
}

/** A valid 1×1 PNG. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export async function userIdOf(testApp: TestApp, nationalNumber: string): Promise<string> {
  const result = await testApp.database.pool.query('SELECT id FROM users WHERE phone_e164 = $1', [
    `+91${nationalNumber}`,
  ]);
  const row = result.rows[0] as { id: string } | undefined;
  if (!row) throw new Error(`No seeded person with number ${nationalNumber}`);
  return row.id;
}

/** Next Monday as YYYY-MM-DD, so plans start on a working day. */
export function nextMonday(from = new Date()): string {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() !== 1);
  return date.toISOString().slice(0, 10);
}
