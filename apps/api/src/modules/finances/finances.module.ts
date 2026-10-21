import {
  type ApplicationStores,
  ProjectAccessService,
  ProjectCostCommands,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { ProjectCostsController } from './project-costs.controller';

type Stores = UnitOfWork<ApplicationStores>;

/** Project profitability: budget against the cost ledger, when the studio switches it on. */
@Module({
  controllers: [ProjectCostsController],
  providers: [
    {
      provide: ProjectAccessService,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: Stores) => new ProjectAccessService(uow.stores.access),
    },
    {
      provide: ProjectCostCommands,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: Stores, clock: Clock) => new ProjectCostCommands(uow, clock),
    },
  ],
})
export class FinancesModule {}
