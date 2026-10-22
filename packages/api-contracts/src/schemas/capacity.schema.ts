import { z } from 'zod';
import { calendarDateSchema, type ResponseSchema } from '../common/primitives';
import { userSummarySchema } from './people.schema';

export const loadStatusSchema = z.enum(['available', 'balanced', 'stretched', 'overloaded']);

export const capacityDaySchema = z.object({
  date: calendarDateSchema,
  isWorkingDay: z.boolean(),
  availableMinutes: z.number().int(),
  confirmedMinutes: z.number().int(),
  tentativeMinutes: z.number().int(),
  blockedMinutes: z.number().int(),
  leave: z.enum(['approved', 'pending']).nullable(),
  status: loadStatusSchema,
});

export const personCapacityObject = z.object({
  user: userSummarySchema,
  team: z.string().nullable(),
  availableMinutes: z.number().int(),
  confirmedMinutes: z.number().int(),
  tentativeMinutes: z.number().int(),
  utilization: z.number(),
  /** Overloaded when the totals are, or when any working day in the range is. */
  status: loadStatusSchema,
  /** The load of the range's totals alone. */
  totalStatus: loadStatusSchema,
  /** Working days booked beyond their available time. */
  overloadedDays: z.number().int(),
  /** Approved leave days with confirmed work still on them. */
  bookedLeaveDays: z.number().int(),
  usesDefaultEstimates: z.boolean(),
  openTaskCount: z.number().int(),
  days: z.array(capacityDaySchema),
});
export type PersonCapacity = z.infer<typeof personCapacityObject>;
export const personCapacitySchema: ResponseSchema<PersonCapacity> = personCapacityObject;

export const capacityOverviewObject = z.object({
  start: calendarDateSchema,
  end: calendarDateSchema,
  people: z.array(personCapacitySchema),
  holidays: z.array(z.object({ date: calendarDateSchema, name: z.string() })),
  defaultEstimateMinutes: z.number().int(),
});
export type CapacityOverview = z.infer<typeof capacityOverviewObject>;
export const capacityOverviewSchema: ResponseSchema<CapacityOverview> = capacityOverviewObject;
