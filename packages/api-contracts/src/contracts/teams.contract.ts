import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { idSchema, versionSchema } from '../common/primitives';
import { teamSchema } from '../schemas/people.schema';

const c = initContract();
const idParams = z.object({ id: idSchema });

/** Types are checked here; lengths and their wording come from the domain rules. */
const teamDefinition = z.object({
  name: z.string().trim().max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  leadUserId: idSchema.nullable().optional(),
});

/**
 * Studio teams. Everyone who can see the directory reads them; changing them
 * needs `users.manage`. Teams are archived, never deleted.
 */
export const teamsContract = c.router({
  listTeams: {
    method: 'GET',
    path: '/teams',
    query: z.object({ status: z.enum(['active', 'archived', 'all']).default('active') }),
    responses: { 200: z.array(teamSchema) },
    summary: 'Teams by name, with their lead and member count. Active teams unless asked.',
  },
  createTeam: {
    method: 'POST',
    path: '/teams',
    body: teamDefinition,
    responses: { 201: teamSchema },
    summary: 'Names are unique in the studio, whatever the case.',
  },
  updateTeam: {
    method: 'PATCH',
    path: '/teams/:id',
    pathParams: idParams,
    body: teamDefinition.partial().extend({ version: versionSchema }),
    responses: { 200: teamSchema },
    summary: 'Rename the team, change its description or lead.',
  },
  archiveTeam: {
    method: 'POST',
    path: '/teams/:id/archive',
    pathParams: idParams,
    body: z.object({ version: versionSchema }),
    responses: { 200: teamSchema },
    summary: 'Only once nobody active is on it. It can no longer be chosen; history stays.',
  },
  restoreTeam: {
    method: 'POST',
    path: '/teams/:id/restore',
    pathParams: idParams,
    body: z.object({ version: versionSchema }),
    responses: { 200: teamSchema },
  },
});
