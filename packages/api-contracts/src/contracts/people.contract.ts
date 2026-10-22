import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../common/pagination';
import {
  emptyBodySchema,
  idSchema,
  noteSchema,
  shortTextSchema,
  versionSchema,
} from '../common/primitives';
import { directoryEntrySchema, roleSchema } from '../schemas/people.schema';

const c = initContract();

const personInput = z.object({
  fullName: shortTextSchema,
  countryCallingCode: z.string().regex(/^\+?\d{1,4}$/),
  nationalNumber: z.string().trim().min(6).max(20),
  email: z.string().email().nullable(),
  designation: z.string().trim().max(120).nullable(),
  role: roleSchema,
  teamId: idSchema.nullable(),
  reportsToUserId: idSchema.nullable(),
  capacityPercent: z.number().int().min(10).max(100),
  /** The person's working week; null or left out follows the studio week. */
  workingCalendarId: idSchema.nullable().optional(),
});

export const peopleContract = c.router({
  listPeople: {
    method: 'GET',
    path: '/people',
    query: pageQuerySchema.extend({
      search: z.string().trim().max(100).optional(),
      teamId: idSchema.optional(),
      role: roleSchema.optional(),
      status: z.enum(['active', 'deactivated', 'all']).default('active'),
    }),
    responses: { 200: pageSchema(directoryEntrySchema) },
    summary: 'Studio directory.',
  },
  getPerson: {
    method: 'GET',
    path: '/people/:id',
    pathParams: z.object({ id: idSchema }),
    responses: { 200: directoryEntrySchema },
  },
  createPerson: {
    method: 'POST',
    path: '/people',
    body: personInput,
    responses: { 201: directoryEntrySchema },
    summary: 'Add a person. They can sign in with their phone number straight away.',
  },
  updatePerson: {
    method: 'PATCH',
    path: '/people/:id',
    pathParams: z.object({ id: idSchema }),
    body: personInput.partial().extend({ version: versionSchema }),
    responses: { 200: directoryEntrySchema },
  },
  deactivatePerson: {
    method: 'POST',
    path: '/people/:id/deactivate',
    pathParams: z.object({ id: idSchema }),
    body: z.object({ reason: noteSchema, version: versionSchema }),
    responses: { 200: directoryEntrySchema },
    summary: 'Deactivate an account and revoke every session.',
  },
  reactivatePerson: {
    method: 'POST',
    path: '/people/:id/reactivate',
    pathParams: z.object({ id: idSchema }),
    body: z.object({ version: versionSchema }),
    responses: { 200: directoryEntrySchema },
  },
  touch: {
    method: 'POST',
    path: '/people/me/heartbeat',
    body: emptyBodySchema,
    responses: { 204: c.noBody() },
    summary: 'Marks the person active (used by the apps when they come to the foreground).',
  },
});
