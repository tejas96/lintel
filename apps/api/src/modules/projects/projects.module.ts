import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { ProjectDetailReader } from './project-detail.reader';
import { ProjectsController } from './projects.controller';
import { projectProviders } from './projects.providers';
import { ScopeChangeReader } from './scope-change.reader';
import { ScopeChangesController } from './scope-changes.controller';

@Module({
  controllers: [ProjectsController, ScopeChangesController, PlanningController],
  providers: [...projectProviders, ProjectDetailReader, ScopeChangeReader],
})
export class ProjectsModule {}
