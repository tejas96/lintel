import { commonErrorResponses } from '../common/errors';
import { authContract } from './auth.contract';
import { deliverablesContract } from './deliverables.contract';
import { documentsContract } from './documents.contract';
import { leaveContract } from './leave.contract';
import { operationsContract } from './operations.contract';
import { peopleContract } from './people.contract';
import { platformContract } from './platform.contract';
import { projectsContract } from './projects.contract';
import { reassignmentsContract } from './reassignments.contract';
import { tasksContract } from './tasks.contract';
import { templateUpdatesContract } from './template-updates.contract';
import { templatesContract } from './templates.contract';
import { workContract } from './work.contract';

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
  readonly documents: typeof documentsContract;
  readonly reassignments: typeof reassignmentsContract;
  readonly templateUpdates: typeof templateUpdatesContract;
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
  documents: documentsContract,
  reassignments: reassignmentsContract,
  templateUpdates: templateUpdatesContract,
};

/** Every route lives under /v1 and shares the error response shape. */
export const apiContractOptions = {
  pathPrefix: '/v1',
  commonResponses: commonErrorResponses,
  strictStatusCodes: true,
} as const;

export { authContract } from './auth.contract';
export { deliverablesContract } from './deliverables.contract';
export { documentsContract } from './documents.contract';
export { leaveContract, leavePeriodSchema } from './leave.contract';
export { operationsContract } from './operations.contract';
export { peopleContract } from './people.contract';
export { platformContract } from './platform.contract';
export { createProjectBodySchema, projectsContract } from './projects.contract';
export { reassignmentsContract } from './reassignments.contract';
export { createTaskBodySchema, tasksContract } from './tasks.contract';
export { templateUpdatesContract } from './template-updates.contract';
export { templatesContract } from './templates.contract';
export { workContract } from './work.contract';
