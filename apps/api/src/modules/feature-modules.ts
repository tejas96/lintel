import type { Type } from '@nestjs/common';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { LeaveModule } from './leave/leave.module';
import { LeavePoliciesModule } from './leave-policies/leave-policies.module';
import { OperationsModule } from './operations/operations.module';
import { PeopleModule } from './people/people.module';
import { ProfileModule } from './profile/profile.module';
import { ProjectsModule } from './projects/projects.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { TemplatesModule } from './templates/templates.module';
import { WorkModule } from './work/work.module';
import { WorkingCalendarsModule } from './working-calendars/working-calendars.module';

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
  ProfileModule,
  LeavePoliciesModule,
  WorkingCalendarsModule,
];
