import { CAPABILITIES, PROJECT_ROLES, ROLES } from '@lintel/domain';
import { z } from 'zod';
import { idSchema, instantSchema, type ResponseSchema } from '../common/primitives';

export const roleSchema = z.enum(ROLES);
export const projectRoleSchema = z.enum(PROJECT_ROLES);
export const capabilitySchema = z.enum(CAPABILITIES);

export const userSummaryObject = z.object({
  id: idSchema,
  fullName: z.string(),
  designation: z.string().nullable(),
  role: roleSchema,
  avatarHue: z.number().int(),
  status: z.enum(['invited', 'active', 'deactivated']),
});
export type UserSummary = z.infer<typeof userSummaryObject>;
export const userSummarySchema: ResponseSchema<UserSummary> = userSummaryObject;

export const currentUserObject = userSummaryObject.extend({
  maskedPhone: z.string(),
  email: z.string().nullable(),
  teamId: idSchema.nullable(),
  capabilities: z.array(capabilitySchema),
  organizationName: z.string(),
  timeZone: z.string(),
  aiFeaturesEnabled: z.literal(false),
});
export type CurrentUser = z.infer<typeof currentUserObject>;
export const currentUserSchema: ResponseSchema<CurrentUser> = currentUserObject;

export const directoryEntryObject = userSummaryObject.extend({
  email: z.string().nullable(),
  maskedPhone: z.string(),
  team: z.object({ id: idSchema, name: z.string() }).nullable(),
  reportsTo: userSummarySchema.nullable(),
  capacityPercent: z.number().int(),
  lastActiveAt: instantSchema.nullable(),
  version: z.number().int(),
  /** The person's working week; null follows the studio week. */
  workingCalendarId: idSchema.nullable(),
});
export type DirectoryEntry = z.infer<typeof directoryEntryObject>;
export const directoryEntrySchema: ResponseSchema<DirectoryEntry> = directoryEntryObject;

export const teamObject = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  memberCount: z.number().int(),
});
export type Team = z.infer<typeof teamObject>;
export const teamSchema: ResponseSchema<Team> = teamObject;
