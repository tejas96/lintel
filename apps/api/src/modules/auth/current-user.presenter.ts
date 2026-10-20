import type { CurrentUser } from '@lintel/api-contracts';
import type { AuthenticatedSession, UserRecord } from '@lintel/application';
import type { Capability } from '@lintel/domain';
import { maskPhoneNumber } from '@lintel/shared';

export interface OrganizationContext {
  readonly name: string;
  readonly timeZone: string;
}

export function presentCurrentUser(
  user: UserRecord,
  capabilities: ReadonlySet<Capability> | readonly Capability[],
  organization: OrganizationContext,
): CurrentUser {
  return {
    id: user.id,
    fullName: user.fullName,
    designation: user.designation,
    role: user.role,
    avatarHue: user.avatarHue,
    status: user.status,
    maskedPhone: maskPhoneNumber(user.phoneE164),
    email: user.email,
    teamId: user.teamId,
    capabilities: [...capabilities].sort(),
    organizationName: organization.name,
    timeZone: organization.timeZone,
    aiFeaturesEnabled: false,
  };
}

export function presentSession(
  auth: AuthenticatedSession,
  organization: OrganizationContext,
): CurrentUser {
  return presentCurrentUser(auth.user, auth.actor.capabilities, organization);
}
