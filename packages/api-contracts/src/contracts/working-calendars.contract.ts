import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, type ResponseSchema, versionSchema } from '../common/primitives';

const c = initContract();
const idParams = z.object({ id: idSchema });

export const workingCalendarObject = z.object({
  id: idSchema,
  name: z.string(),
  timeZone: z.string(),
  /** The studio week: people without a working week of their own follow it. */
  isDefault: z.boolean(),
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  workingWeekdays: z.array(z.number().int()),
  dayStartTime: z.string(),
  dayEndTime: z.string(),
  workingMinutesPerDay: z.number().int(),
  peopleCount: z.number().int(),
  version: z.number().int(),
});
export type ManagedWorkingCalendar = z.infer<typeof workingCalendarObject>;
export const workingCalendarSchema: ResponseSchema<ManagedWorkingCalendar> = workingCalendarObject;

/** Types are checked here; the ranges and their wording come from the domain rules. */
const workingWeekInput = z.object({
  name: z.string().trim().max(200),
  workingWeekdays: z.array(z.number().int()).max(7),
  dayStartTime: z.string().max(5),
  dayEndTime: z.string().max(5),
  workingMinutesPerDay: z.number().int(),
});

/**
 * The studio week and other working weeks (part-time, site teams). Reading
 * needs `organization.manage_settings` or `users.manage` (people are assigned
 * a week in People); changes need `organization.manage_settings`.
 */
export const workingCalendarsContract = c.router({
  listWorkingCalendars: {
    method: 'GET',
    path: '/settings/calendars',
    responses: { 200: z.array(workingCalendarSchema) },
  },
  createWorkingCalendar: {
    method: 'POST',
    path: '/settings/calendars',
    body: workingWeekInput,
    responses: { 201: workingCalendarSchema },
  },
  updateWorkingCalendar: {
    method: 'PATCH',
    path: '/settings/calendars/:id',
    pathParams: idParams,
    body: workingWeekInput.partial().extend({ version: versionSchema }),
    responses: { 200: workingCalendarSchema },
    summary:
      'Capacity, planning, leave and reminders use the new week from their next calculation.',
  },
  removeWorkingCalendar: {
    method: 'DELETE',
    path: '/settings/calendars/:id',
    pathParams: idParams,
    body: c.noBody(),
    responses: { 204: c.noBody() },
    summary: 'Only a week nobody follows can be removed; the studio week never can.',
  },
});
