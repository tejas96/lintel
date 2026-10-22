import type { Type } from '@nestjs/common';
import { DateChangesModule } from './date-changes/date-changes.module';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { DocumentsModule } from './documents/documents.module';
import { FinancesModule } from './finances/finances.module';
import { InsightsModule } from './insights/insights.module';
import { LeaveModule } from './leave/leave.module';
import { LeavePoliciesModule } from './leave-policies/leave-policies.module';
import { OperationsModule } from './operations/operations.module';
import { PeopleModule } from './people/people.module';
import { ProfileModule } from './profile/profile.module';
import { ProjectsModule } from './projects/projects.module';
import { ReassignmentsModule } from './reassignments/reassignments.module';
import { ReportsModule } from './reports/reports.module';
import { RewardRecordsModule } from './rewards/reward-records.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { TeamsModule } from './teams/teams.module';
import { TemplateUpdatesModule } from './template-updates/template-updates.module';
import { TemplatesModule } from './templates/templates.module';
import { WorkModule } from './work/work.module';
import { WorkingCalendarsModule } from './working-calendars/working-calendars.module';

/**
 * Business modules registered with the application. Each feature module owns
 * its controllers and use-case providers; add new ones here (one line each).
 */
export const FEATURE_MODULES: Type[] = [
  PeopleModule,
  TeamsModule,
  ProjectsModule,
  TemplatesModule,
  SettingsModule,
  TasksModule,
  WorkModule,
  DeliverablesModule,
  LeaveModule,
  OperationsModule,
  ReportsModule,
  FinancesModule,
  ProfileModule,
  LeavePoliciesModule,
  WorkingCalendarsModule,
  DocumentsModule,
  ReassignmentsModule,
  TemplateUpdatesModule,
  InsightsModule,
  DateChangesModule,
  RewardRecordsModule,
];
