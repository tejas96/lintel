import type { Role } from '@lintel/domain';
import { maskPhoneNumber } from '@lintel/shared';
import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { teams, users } from '../../schema';

export interface OwnProfileView {
  readonly id: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly designation: string | null;
  readonly maskedPhone: string;
  readonly role: Role;
  readonly team: { readonly id: string; readonly name: string } | null;
  readonly avatarHue: number;
  readonly version: number;
}

/** The signed-in person as they see themselves. The phone number is always masked. */
export async function findOwnProfile(
  db: DatabaseExecutor,
  userId: string,
): Promise<OwnProfileView | null> {
  const [row] = await db
    .select({ user: users, team: { id: teams.id, name: teams.name } })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(eq(users.id, userId));
  if (!row) return null;
  const { user, team } = row;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    designation: user.designation,
    maskedPhone: maskPhoneNumber(user.phoneE164),
    role: user.role,
    team: team?.id ? team : null,
    avatarHue: user.avatarHue,
    version: user.version,
  };
}
