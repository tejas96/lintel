import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, shortTextSchema } from '../common/primitives';
import { capabilitySchema, roleSchema } from '../schemas/people.schema';

const c = initContract();

const organizationSchema = z.object({
  name: z.string(),
  timeZone: z.string(),
  currency: z.string(),
  projectReferencePrefix: z.string(),
  deadlineReminderTime: z.string(),
  defaultQuietHoursStart: z.string(),
  defaultQuietHoursEnd: z.string(),
  leaveSecondApprovalAboveHalfDays: z.number().int(),
  workTrackingEnabled: z.boolean(),
  profitabilityEnabled: z.boolean(),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm.');

export const platformContract = c.router({
  getOrganization: {
    method: 'GET',
    path: '/settings/organization',
    responses: { 200: organizationSchema },
  },
  updateOrganization: {
    method: 'PUT',
    path: '/settings/organization',
    body: organizationSchema.extend({
      name: shortTextSchema,
      projectReferencePrefix: z.string().regex(/^[A-Z]{2,5}$/),
      deadlineReminderTime: time,
      defaultQuietHoursStart: time,
      defaultQuietHoursEnd: time,
      leaveSecondApprovalAboveHalfDays: z.number().int().min(1).max(120),
      /** Optional so older clients keep the current value. */
      profitabilityEnabled: z.boolean().optional(),
    }),
    responses: { 200: organizationSchema },
  },
  getRoleCapabilities: {
    method: 'GET',
    path: '/settings/roles',
    responses: {
      200: z.array(z.object({ role: roleSchema, capabilities: z.array(capabilitySchema) })),
    },
  },
  updateRoleCapabilities: {
    method: 'PUT',
    path: '/settings/roles/:role',
    pathParams: z.object({ role: roleSchema }),
    body: z.object({ capabilities: z.array(capabilitySchema) }),
    responses: { 200: z.object({ role: roleSchema, capabilities: z.array(capabilitySchema) }) },
    summary: 'The owner role always keeps every capability.',
  },
  listHolidays: {
    method: 'GET',
    path: '/settings/holidays',
    responses: { 200: z.array(z.object({ id: idSchema, date: z.string(), name: z.string() })) },
  },
  addHoliday: {
    method: 'POST',
    path: '/settings/holidays',
    body: z.object({ date: z.string(), name: shortTextSchema }),
    responses: { 201: z.object({ id: idSchema, date: z.string(), name: z.string() }) },
  },
  removeHoliday: {
    method: 'DELETE',
    path: '/settings/holidays/:id',
    pathParams: z.object({ id: idSchema }),
    body: c.noBody(),
    responses: { 204: c.noBody() },
  },
  health: {
    method: 'GET',
    path: '/health',
    responses: { 200: z.object({ status: z.literal('ok') }) },
    summary: 'Liveness: the process is running.',
  },
  readiness: {
    method: 'GET',
    path: '/health/ready',
    responses: {
      200: z.object({
        status: z.enum(['ready', 'degraded']),
        checks: z.object({
          database: z.boolean(),
          objectStorage: z.boolean(),
          temporal: z.union([z.boolean(), z.literal('disabled')]),
        }),
      }),
    },
    summary: 'Readiness: dependencies are reachable. Degraded when optional services are down.',
  },
  aiStatus: {
    method: 'GET',
    path: '/ai/status',
    responses: { 200: z.object({ enabled: z.literal(false), message: z.string() }) },
    summary: 'AI is reserved for Phase 2 and always reports disabled.',
  },
});
