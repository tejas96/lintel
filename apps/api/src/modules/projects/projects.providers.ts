import {
  type ApplicationStores,
  CompleteMilestoneCommand,
  CreateProjectCommand,
  DecideScopeChangeCommand,
  ManageProjectCommands,
  Notifier,
  PreviewProjectPlanQuery,
  ProjectAccessService,
  type ProjectCommandDependencies,
  ProposeScopeChangeCommand,
  RecordClientSignOffCommand,
  RescheduleTasksCommand,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import type { Provider } from '@nestjs/common';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';

/** Injection token for the shared dependencies of project use cases. */
export const PROJECT_COMMAND_DEPENDENCIES = Symbol('PROJECT_COMMAND_DEPENDENCIES');

type Dependencies = ProjectCommandDependencies;

/** Unit of work, clock and notifier factory for project use cases (shared with template updates). */
export const projectCommandDependenciesProvider: Provider = {
  provide: PROJECT_COMMAND_DEPENDENCIES,
  inject: [UNIT_OF_WORK, CLOCK, BusinessContextService],
  useFactory: (
    uow: UnitOfWork<ApplicationStores>,
    clock: Clock,
    business: BusinessContextService,
  ): Dependencies => ({
    uow,
    clock,
    notifierFor: async (stores) =>
      new Notifier(stores.notifications, stores.records, clock, await business.notifierDefaults()),
  }),
};

/** Wires project, milestone and scope-change use cases to their adapters. */
export const projectProviders: Provider[] = [
  projectCommandDependenciesProvider,
  {
    provide: ProjectAccessService,
    inject: [UNIT_OF_WORK],
    useFactory: (uow: UnitOfWork<ApplicationStores>) => new ProjectAccessService(uow.stores.access),
  },
  {
    provide: CreateProjectCommand,
    inject: [PROJECT_COMMAND_DEPENDENCIES],
    useFactory: (deps: Dependencies) => new CreateProjectCommand(deps),
  },
  {
    provide: ManageProjectCommands,
    inject: [PROJECT_COMMAND_DEPENDENCIES],
    useFactory: (deps: Dependencies) => new ManageProjectCommands(deps),
  },
  {
    provide: CompleteMilestoneCommand,
    inject: [PROJECT_COMMAND_DEPENDENCIES],
    useFactory: (deps: Dependencies) => new CompleteMilestoneCommand(deps),
  },
  {
    provide: ProposeScopeChangeCommand,
    inject: [PROJECT_COMMAND_DEPENDENCIES],
    useFactory: (deps: Dependencies) => new ProposeScopeChangeCommand(deps),
  },
  {
    provide: DecideScopeChangeCommand,
    inject: [PROJECT_COMMAND_DEPENDENCIES],
    useFactory: (deps: Dependencies) => new DecideScopeChangeCommand(deps),
  },
  {
    provide: RecordClientSignOffCommand,
    inject: [PROJECT_COMMAND_DEPENDENCIES],
    useFactory: (deps: Dependencies) => new RecordClientSignOffCommand(deps),
  },
  {
    provide: RescheduleTasksCommand,
    inject: [PROJECT_COMMAND_DEPENDENCIES],
    useFactory: (deps: Dependencies) => new RescheduleTasksCommand(deps),
  },
  {
    provide: PreviewProjectPlanQuery,
    inject: [UNIT_OF_WORK],
    useFactory: (uow: UnitOfWork<ApplicationStores>) => new PreviewProjectPlanQuery(uow),
  },
];
