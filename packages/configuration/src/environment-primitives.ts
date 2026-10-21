import { z } from 'zod';

/** "true"/"false"/"1"/"0" from the environment, as a boolean. */
export const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/** 24-hour "HH:mm". */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm.');
