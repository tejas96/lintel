import type { RequestContext } from '@lintel/application';
import type { Capability } from '@lintel/domain';
import {
  ForbiddenError,
  NotFoundError,
  toPhoneNumberE164,
  ValidationFailedError,
} from '@lintel/shared';

/** Throws 403 unless the actor holds the capability. Use for organisation-wide actions. */
export function requireCapability(context: RequestContext, capability: Capability): void {
  if (!context.actor.capabilities.has(capability)) throw new ForbiddenError();
}

/** Returns the value or throws 404, so read models can return null for "missing or hidden". */
export function found<T>(value: T | null | undefined, entity: string): T {
  if (value === null || value === undefined) throw new NotFoundError(entity);
  return value;
}

export function phoneFromInput(input: {
  countryCallingCode: string;
  nationalNumber: string;
}): string {
  const phone = toPhoneNumberE164(input.countryCallingCode, input.nationalNumber);
  if (!phone) {
    throw new ValidationFailedError('Enter a valid phone number.', [
      { field: 'nationalNumber', message: 'This does not look like a valid phone number.' },
    ]);
  }
  return phone;
}

/** Wraps a page result into the contract's page shape. */
export function pageOf<T>(items: readonly T[], page: number, pageSize: number, totalItems: number) {
  return {
    items: [...items],
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}
