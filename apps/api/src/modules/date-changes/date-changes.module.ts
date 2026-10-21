import {
  type ApplicationStores,
  type DateChangeDependencies,
  DateChangeViewerQuery,
  DecideDateChangeCommand,
  type OperationsDependencies,
  RequestDateChangeCommands,
  type UnitOfWork,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import { OPERATIONS_DEPENDENCIES } from '../tasks/operations.providers';
import { TasksModule } from '../tasks/tasks.module';
import { DateChangesController } from './date-changes.controller';

const DATE_CHANGE_DEPENDENCIES = Symbol('DATE_CHANGE_DEPENDENCIES');

/** Asking the project manager for new task dates, and the decision. */
@Module({
  imports: [TasksModule],
  controllers: [DateChangesController],
  providers: [
    {
      provide: DATE_CHANGE_DEPENDENCIES,
      inject: [UNIT_OF_WORK, OPERATIONS_DEPENDENCIES],
      useFactory: (
        uow: UnitOfWork<ApplicationStores>,
        operations: OperationsDependencies,
      ): DateChangeDependencies => ({
        uow,
        clock: operations.clock,
        operations: operations.context,
      }),
    },
    {
      provide: RequestDateChangeCommands,
      inject: [DATE_CHANGE_DEPENDENCIES],
      useFactory: (deps: DateChangeDependencies) => new RequestDateChangeCommands(deps),
    },
    {
      provide: DecideDateChangeCommand,
      inject: [DATE_CHANGE_DEPENDENCIES],
      useFactory: (deps: DateChangeDependencies) => new DecideDateChangeCommand(deps),
    },
    {
      provide: DateChangeViewerQuery,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new DateChangeViewerQuery(uow.stores),
    },
  ],
})
export class DateChangesModule {}
