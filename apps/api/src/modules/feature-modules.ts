import type { Type } from '@nestjs/common';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { PeopleModule } from './people/people.module';
import { TasksModule } from './tasks/tasks.module';
import { WorkModule } from './work/work.module';

/**
 * Business modules registered with the application. Each feature module owns
 * its controllers and use-case providers; add new ones here (one line each).
 */
export const FEATURE_MODULES: Type[] = [PeopleModule, TasksModule, WorkModule, DeliverablesModule];
