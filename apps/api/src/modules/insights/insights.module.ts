import {
  type ApplicationStores,
  CapacityQuery,
  CoverSuggestionsQuery,
  LeaveQueries,
  ProjectAccessService,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { InsightsController } from './insights.controller';

type Stores = UnitOfWork<ApplicationStores>;

/** The command center briefing, project risk cards and cover suggestions for absences. */
@Module({
  controllers: [InsightsController],
  providers: [
    {
      provide: CapacityQuery,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: Stores, clock: Clock) => new CapacityQuery(uow, clock),
    },
    {
      provide: ProjectAccessService,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: Stores) => new ProjectAccessService(uow.stores.access),
    },
    {
      provide: CoverSuggestionsQuery,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: Stores, clock: Clock) =>
        new CoverSuggestionsQuery(uow, clock, new LeaveQueries(uow, clock)),
    },
  ],
})
export class InsightsModule {}
