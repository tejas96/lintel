import {
  type ApplicationStores,
  ApplyTemplateUpdateCommand,
  PreviewTemplateUpdateQuery,
  type ProjectCommandDependencies,
  TemplateUpdateStatusQuery,
  type UnitOfWork,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import {
  PROJECT_COMMAND_DEPENDENCIES,
  projectCommandDependenciesProvider,
} from '../projects/projects.providers';
import { TemplateUpdatesController } from './template-updates.controller';

/** Moving running projects to a newer published version of their template. */
@Module({
  controllers: [TemplateUpdatesController],
  providers: [
    projectCommandDependenciesProvider,
    {
      provide: PreviewTemplateUpdateQuery,
      inject: [PROJECT_COMMAND_DEPENDENCIES],
      useFactory: (deps: ProjectCommandDependencies) => new PreviewTemplateUpdateQuery(deps),
    },
    {
      provide: ApplyTemplateUpdateCommand,
      inject: [PROJECT_COMMAND_DEPENDENCIES],
      useFactory: (deps: ProjectCommandDependencies) => new ApplyTemplateUpdateCommand(deps),
    },
    {
      provide: TemplateUpdateStatusQuery,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new TemplateUpdateStatusQuery(uow.stores),
    },
  ],
})
export class TemplateUpdatesModule {}
