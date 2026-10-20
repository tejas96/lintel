import { isCalendarDate } from '@lintel/shared';
import { z } from 'zod';

export const idSchema = z.string().uuid();
export const calendarDateSchema = z
  .string()
  .refine(
    (value: string): boolean => isCalendarDate(value),
    'Use a real date in YYYY-MM-DD format.',
  );
export const instantSchema = z.string().datetime({ offset: true });
export const versionSchema = z.number().int().positive();
export const moneyMinorSchema = z.number().int();
export const shortTextSchema = z.string().trim().min(1).max(200);
export const longTextSchema = z.string().trim().max(5000);
export const noteSchema = z.string().trim().min(3, 'Add a short explanation.').max(2000);

export const emptyBodySchema = z.object({}).strict();
export const idParamsSchema = z.object({ id: idSchema });

/**
 * Response schemas are exported with this explicit type so declaration files
 * refer to the named type instead of repeating the full Zod structure.
 */
export type ResponseSchema<T> = z.ZodType<T, z.ZodTypeDef, T>;

/**
 * A boolean in a query string. `z.coerce.boolean()` would turn the string
 * "false" into `true`, so only the literal words true/false (or 1/0) are accepted.
 */
export const queryBooleanSchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');
