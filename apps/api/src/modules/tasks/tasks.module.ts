import {
  type ApplicationStores,
  AssignTaskCommands,
  CreateTaskCommand,
  ProjectAccessService,
  TaskBlockerCommands,
  TaskCommentCommands,
  TaskStructureCommands,
  TaskViewerQuery,
  TransitionTaskCommand,
  type UnitOfWork,
  UpdateTaskCommand,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import {
  OPERATIONS_DEPENDENCIES,
  operationsDependenciesProvider,
  operationsUseCase,
  projectAccessProvider,
} from './operations.providers';
import { TaskCollaborationController } from './task-collaboration.controller';
import { TaskDetailPresenter } from './task-detail.presenter';
import { TasksController } from './tasks.controller';

@Module({
  controllers: [TasksController, TaskCollaborationController],
  providers: [
    operationsDependenciesProvider,
    projectAccessProvider,
    operationsUseCase(CreateTaskCommand),
    operationsUseCase(UpdateTaskCommand),
    operationsUseCase(TransitionTaskCommand),
    operationsUseCase(AssignTaskCommands),
    operationsUseCase(TaskStructureCommands),
    operationsUseCase(TaskBlockerCommands),
    operationsUseCase(TaskCommentCommands),
    {
      provide: TaskViewerQuery,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new TaskViewerQuery(uow.stores),
    },
    TaskDetailPresenter,
  ],
  exports: [OPERATIONS_DEPENDENCIES, TaskDetailPresenter, ProjectAccessService],
})
export class TasksModule {}
