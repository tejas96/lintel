import type { Type } from '@nestjs/common';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { DocumentsModule } from './documents/documents.module';
import { LeaveModule } from './leave/leave.module';
import { OperationsModule } from './operations/operations.module';
import { PeopleModule } from './people/people.module';
import { ProjectsModule } from './projects/projects.module';
import { ReassignmentsModule } from './reassignments/reassignments.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { TemplateUpdatesModule } from './template-updates/template-updates.module';
import { TemplatesModule } from './templates/templates.module';
import { WorkModule } from './work/work.module';

/**
 * Business modules registered with the application. Each feature module owns
 * its controllers and use-case providers; add new ones here (one line each).
 */
export const FEATURE_MODULES: Type[] = [
  PeopleModule,
  ProjectsModule,
  TemplatesModule,
  SettingsModule,
  TasksModule,
  WorkModule,
  DeliverablesModule,
  LeaveModule,
  OperationsModule,
  DocumentsModule,
  ReassignmentsModule,
  TemplateUpdatesModule,
];
