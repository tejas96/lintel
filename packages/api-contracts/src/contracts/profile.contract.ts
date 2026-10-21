import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { emptyBodySchema, versionSchema } from '../common/primitives';
import { guidanceSchema, guidanceTipKeySchema } from '../schemas/planning.schema';
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
  getMyGuidance: {
    method: 'GET',
    path: '/me/guidance',
    responses: { 200: guidanceSchema },
    summary: 'First-run tips for your role, and which ones you have already seen.',
  },
  markGuidanceSeen: {
    method: 'POST',
    path: '/me/guidance/:tip/seen',
    pathParams: z.object({ tip: guidanceTipKeySchema }),
    body: emptyBodySchema,
    responses: { 200: guidanceSchema },
    summary: 'Remember that you saw a tip, so it does not show again on any device.',
  },
  resetGuidance: {
    method: 'POST',
    path: '/me/guidance/reset',
    body: emptyBodySchema,
    responses: { 200: guidanceSchema },
    summary: 'Show the first-run tips again.',
  },
});
