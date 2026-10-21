import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { versionSchema } from '../common/primitives';
import { ownProfileSchema } from '../schemas/profile.schema';

const c = initContract();

/**
 * The signed-in person's own profile. Only name, email and designation can be
 * changed here; the body is strict, so role, phone or status are refused.
 */
export const profileContract = c.router({
  getMyProfile: {
    method: 'GET',
    path: '/me/profile',
    responses: { 200: ownProfileSchema },
    summary: 'Your own profile and its version.',
  },
  updateMyProfile: {
    method: 'PATCH',
    path: '/me/profile',
    body: z
      .object({
        fullName: z.string().trim().min(2, 'Use at least 2 characters.').max(200),
        email: z.string().trim().email('Check the email address.').max(200).nullable(),
        designation: z.string().trim().max(120).nullable(),
      })
      .partial()
      .extend({ version: versionSchema })
      .strict(),
    responses: { 200: ownProfileSchema },
    summary:
      'Change your own name, email or designation. Role, phone number and status stay with administrators.',
  },
});
