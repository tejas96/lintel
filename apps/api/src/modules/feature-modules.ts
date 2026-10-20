import type { Type } from '@nestjs/common';
import { LeaveModule } from './leave/leave.module';
import { OperationsModule } from './operations/operations.module';
import { PeopleModule } from './people/people.module';

/**
 * Business modules registered with the application. Each feature module owns
 * its controllers and use-case providers; add new ones here (one line each).
 */
export const FEATURE_MODULES: Type[] = [PeopleModule, LeaveModule, OperationsModule];
