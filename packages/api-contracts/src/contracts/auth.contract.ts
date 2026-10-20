import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { emptyBodySchema, idSchema, instantSchema } from '../common/primitives';
import { currentUserSchema } from '../schemas/people.schema';

const c = initContract();

const phoneInput = z.object({
  countryCallingCode: z.string().regex(/^\+?\d{1,4}$/, 'Choose a country code.'),
  nationalNumber: z.string().trim().min(6, 'Enter your phone number.').max(20),
});

export const authContract = c.router({
  requestOtp: {
    method: 'POST',
    path: '/auth/otp/request',
    body: phoneInput,
    responses: {
      200: z.object({
        maskedPhone: z.string(),
        expiresInSeconds: z.number().int(),
        resendAvailableInSeconds: z.number().int(),
      }),
    },
    summary:
      'Send a sign-in code. The answer is the same whether or not the number has an account.',
  },
  verifyOtp: {
    method: 'POST',
    path: '/auth/otp/verify',
    body: phoneInput.extend({
      code: z.string().regex(/^\d{4,8}$/, 'Enter the code from the SMS.'),
      client: z.enum(['web', 'mobile']),
    }),
    responses: {
      200: z.object({
        user: currentUserSchema,
        expiresAt: instantSchema,
        /** Only for mobile clients. Web clients receive an HttpOnly cookie instead. */
        sessionToken: z.string().nullable(),
      }),
    },
    summary: 'Verify a code and open a session.',
  },
  me: {
    method: 'GET',
    path: '/auth/me',
    responses: { 200: currentUserSchema },
    summary: 'The signed-in person, their capabilities and studio settings.',
  },
  signOut: {
    method: 'POST',
    path: '/auth/sign-out',
    body: emptyBodySchema,
    responses: { 204: c.noBody() },
    summary: 'End the current session.',
  },
  listSessions: {
    method: 'GET',
    path: '/auth/sessions',
    responses: {
      200: z.array(
        z.object({
          id: idSchema,
          client: z.enum(['web', 'mobile']),
          userAgent: z.string().nullable(),
          createdAt: instantSchema,
          lastSeenAt: instantSchema,
          isCurrent: z.boolean(),
        }),
      ),
    },
    summary: 'Active sessions of the signed-in person.',
  },
  revokeSession: {
    method: 'DELETE',
    path: '/auth/sessions/:id',
    pathParams: z.object({ id: idSchema }),
    body: c.noBody(),
    responses: { 204: c.noBody() },
    summary: 'Sign out a session on another device.',
  },
});
