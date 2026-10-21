import { commonErrorResponses } from '../common/errors';
import { authContract } from './auth.contract';
import { deliverablesContract } from './deliverables.contract';
import { leaveContract } from './leave.contract';
import { leavePoliciesContract } from './leave-policies.contract';
import { operationsContract } from './operations.contract';
import { peopleContract } from './people.contract';
import { platformContract } from './platform.contract';
import { profileContract } from './profile.contract';
import { projectsContract } from './projects.contract';
import { tasksContract } from './tasks.contract';
import { templatesContract } from './templates.contract';
import { workContract } from './work.contract';
import { workingCalendarsContract } from './working-calendars.contract';

/**
 * The whole public API, as module contracts. Each app assembles the router with
 * `initContract().router(apiRouterDefinition, apiContractOptions)` — building it
 * here would exceed TypeScript's declaration-size limit (TS7056).
 */
export type ApiRouterDefinition = {
  readonly auth: typeof authContract;
  readonly people: typeof peopleContract;
  readonly projects: typeof projectsContract;
  readonly templates: typeof templatesContract;
  readonly tasks: typeof tasksContract;
  readonly work: typeof workContract;
  readonly deliverables: typeof deliverablesContract;
  readonly leave: typeof leaveContract;
  readonly operations: typeof operationsContract;
  readonly platform: typeof platformContract;
  readonly profile: typeof profileContract;
  readonly leavePolicies: typeof leavePoliciesContract;
  readonly workingCalendars: typeof workingCalendarsContract;
};

export const apiRouterDefinition: ApiRouterDefinition = {
  auth: authContract,
  people: peopleContract,
  projects: projectsContract,
  templates: templatesContract,
  tasks: tasksContract,
  work: workContract,
  deliverables: deliverablesContract,
  leave: leaveContract,
  operations: operationsContract,
  platform: platformContract,
  profile: profileContract,
  leavePolicies: leavePoliciesContract,
  workingCalendars: workingCalendarsContract,
};

/** Every route lives under /v1 and shares the error response shape. */
export const apiContractOptions = {
  pathPrefix: '/v1',
  commonResponses: commonErrorResponses,
  strictStatusCodes: true,
} as const;

export { authContract } from './auth.contract';
export { deliverablesContract } from './deliverables.contract';
export { leaveContract, leavePeriodSchema } from './leave.contract';
export { leavePoliciesContract } from './leave-policies.contract';
export { operationsContract } from './operations.contract';
export { peopleContract } from './people.contract';
export { platformContract } from './platform.contract';
export { profileContract } from './profile.contract';
export { createProjectBodySchema, projectsContract } from './projects.contract';
export { createTaskBodySchema, tasksContract } from './tasks.contract';
export { templatesContract } from './templates.contract';
export { workContract } from './work.contract';
export {
  type ManagedWorkingCalendar,
  workingCalendarSchema,
  workingCalendarsContract,
} from './working-calendars.contract';
