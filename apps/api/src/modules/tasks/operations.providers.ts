import {
  type ApplicationStores,
  Notifier,
  type OperationsDependencies,
  ProjectAccessService,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import type { Provider } from '@nestjs/common';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';

/** Unit of work, clock and studio context shared by task, work and deliverable use cases. */
export const OPERATIONS_DEPENDENCIES = Symbol('OPERATIONS_DEPENDENCIES');

export const operationsDependenciesProvider: Provider = {
  provide: OPERATIONS_DEPENDENCIES,
  inject: [UNIT_OF_WORK, CLOCK, BusinessContextService],
  useFactory: (
    uow: UnitOfWork<ApplicationStores>,
    clock: Clock,
    business: BusinessContextService,
  ): OperationsDependencies => ({
    uow,
    clock,
    context: {
      today: () => business.today(),
      notifierFor: async (stores) =>
        new Notifier(
          stores.notifications,
          stores.records,
          clock,
          await business.notifierDefaults(),
        ),
    },
  }),
};

/** Registers a use case whose constructor takes only the operations dependencies. */
export function operationsUseCase<T>(type: new (deps: OperationsDependencies) => T): Provider {
  return {
    provide: type,
    inject: [OPERATIONS_DEPENDENCIES],
    useFactory: (deps: OperationsDependencies) => new type(deps),
  };
}

/** Project access checks for read routes (missing and forbidden both answer 404). */
export const projectAccessProvider: Provider = {
  provide: ProjectAccessService,
  inject: [UNIT_OF_WORK],
  useFactory: (uow: UnitOfWork<ApplicationStores>) => new ProjectAccessService(uow.stores.access),
};
