import type { ReassignmentCheck } from '@lintel/domain';
import {
  type ApplicationError,
  ConflictError,
  ForbiddenError,
  PreconditionFailedError,
  ValidationFailedError,
} from '@lintel/shared';

/** Turns a refused reassignment step into the matching API error. */
export function assertReassignmentAllowed(check: ReassignmentCheck): void {
  if (check.allowed) return;
  const errors: Record<typeof check.problem, () => ApplicationError> = {
    forbidden: () => new ForbiddenError(check.reason),
    conflict: () => new ConflictError(check.reason),
    closed: () => new PreconditionFailedError(check.reason),
    invalid: () =>
      new ValidationFailedError(check.reason, [
        check.field ? { field: check.field, message: check.reason } : { message: check.reason },
      ]),
  };
  throw errors[check.problem]();
}
