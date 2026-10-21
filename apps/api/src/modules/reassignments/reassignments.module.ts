import {
  type ApplicationStores,
  DecideReassignmentCommand,
  type OperationsDependencies,
  type ReassignmentDependencies,
  ReassignmentViewerQuery,
  RequestReassignmentCommands,
  type UnitOfWork,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import { OPERATIONS_DEPENDENCIES } from '../tasks/operations.providers';
import { TasksModule } from '../tasks/tasks.module';
import { ReassignmentsController } from './reassignments.controller';

const REASSIGNMENT_DEPENDENCIES = Symbol('REASSIGNMENT_DEPENDENCIES');

/** Asking the project manager to reassign a task, and the manager's decision. */
@Module({
  imports: [TasksModule],
  controllers: [ReassignmentsController],
  providers: [
    {
      provide: REASSIGNMENT_DEPENDENCIES,
      inject: [UNIT_OF_WORK, OPERATIONS_DEPENDENCIES],
      useFactory: (
        uow: UnitOfWork<ApplicationStores>,
        operations: OperationsDependencies,
      ): ReassignmentDependencies => ({
        uow,
        clock: operations.clock,
        operations: operations.context,
      }),
    },
    {
      provide: RequestReassignmentCommands,
      inject: [REASSIGNMENT_DEPENDENCIES],
      useFactory: (deps: ReassignmentDependencies) => new RequestReassignmentCommands(deps),
    },
    {
      provide: DecideReassignmentCommand,
      inject: [REASSIGNMENT_DEPENDENCIES],
      useFactory: (deps: ReassignmentDependencies) => new DecideReassignmentCommand(deps),
    },
    {
      provide: ReassignmentViewerQuery,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new ReassignmentViewerQuery(uow.stores),
    },
  ],
})
export class ReassignmentsModule {}
