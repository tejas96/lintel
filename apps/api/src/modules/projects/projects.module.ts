import { Module } from '@nestjs/common';
import { ProjectDetailReader } from './project-detail.reader';
import { ProjectsController } from './projects.controller';
import { projectProviders } from './projects.providers';
import { ScopeChangesController } from './scope-changes.controller';

@Module({
  controllers: [ProjectsController, ScopeChangesController],
  providers: [...projectProviders, ProjectDetailReader],
})
export class ProjectsModule {}
