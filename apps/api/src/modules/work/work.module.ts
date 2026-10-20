import {
  type ApplicationStores,
  MyWorkQueueQuery,
  type OperationsDependencies,
  PriorityConflictCommands,
  type UnitOfWork,
  WorkSessionCommands,
} from '@lintel/application';
import { type DatabaseConnection, WorkQueueReadModel } from '@lintel/database';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, DATABASE_CONNECTION, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { OPERATIONS_DEPENDENCIES, operationsUseCase } from '../tasks/operations.providers';
import { TasksModule } from '../tasks/tasks.module';
import { WorkController } from './work.controller';

@Module({
  imports: [TasksModule],
  controllers: [WorkController],
  providers: [
    operationsUseCase(WorkSessionCommands),
    operationsUseCase(PriorityConflictCommands),
    {
      provide: MyWorkQueueQuery,
      inject: [DATABASE_CONNECTION, UNIT_OF_WORK, OPERATIONS_DEPENDENCIES, CLOCK],
      useFactory: (
        database: DatabaseConnection,
        uow: UnitOfWork<ApplicationStores>,
        deps: OperationsDependencies,
        clock: Clock,
      ) =>
        new MyWorkQueueQuery(
          new WorkQueueReadModel(database.db),
          uow.stores.settings,
          deps.context,
          clock,
        ),
    },
  ],
})
export class WorkModule {}
