import { ERROR_CODES } from '@lintel/shared';
import { z } from 'zod';

/** Every non-2xx response has this shape. `message` is always safe to show. */
export const errorResponseSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.array(z.object({ field: z.string().optional(), message: z.string() })),
  requestId: z.string(),
  retryAfterSeconds: z.number().int().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const commonErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
  503: errorResponseSchema,
} as const;
