import { z } from 'zod';
import { idSchema, type ResponseSchema } from '../common/primitives';
import { roleSchema } from './people.schema';

/** What the signed-in person sees about themselves, with the version their edits must send. */
export const ownProfileObject = z.object({
  id: idSchema,
  fullName: z.string(),
  email: z.string().nullable(),
  designation: z.string().nullable(),
  maskedPhone: z.string(),
  role: roleSchema,
  team: z.object({ id: idSchema, name: z.string() }).nullable(),
  avatarHue: z.number().int(),
  version: z.number().int(),
});
export type OwnProfile = z.infer<typeof ownProfileObject>;
export const ownProfileSchema: ResponseSchema<OwnProfile> = ownProfileObject;
