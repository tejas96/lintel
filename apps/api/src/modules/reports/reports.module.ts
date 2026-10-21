import {
  type ApplicationStores,
  CapacityQuery,
  ProjectAccessService,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { ReportExportController } from './report-export.controller';
import { ReportRunner } from './report-runner.service';
import { ReportsController } from './reports.controller';

type Stores = UnitOfWork<ApplicationStores>;

/** Owner and manager reports (JSON and CSV). Read-only: nothing here writes. */
@Module({
  controllers: [ReportsController, ReportExportController],
  providers: [
    ReportRunner,
    {
      provide: ProjectAccessService,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: Stores) => new ProjectAccessService(uow.stores.access),
    },
    {
      provide: CapacityQuery,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: Stores, clock: Clock) => new CapacityQuery(uow, clock),
    },
  ],
})
export class ReportsModule {}
