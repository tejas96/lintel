import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { calendarDateSchema, idSchema } from '../common/primitives';
import {
  briefingSchema,
  coverSuggestionsSchema,
  projectRisksSchema,
} from '../schemas/insights.schema';

const c = initContract();

const idParams = z.object({ id: idSchema });

/** Explaining problems and the next action: health score, risk cards, cover suggestions. */
export const insightsContract = c.router({
  commandCenterBriefing: {
    method: 'GET',
    path: '/dashboard/briefing',
    query: z.object({
      from: calendarDateSchema.optional(),
      to: calendarDateSchema.optional(),
      projectId: idSchema.optional(),
      managerUserId: idSchema.optional(),
      teamId: idSchema.optional(),
    }),
    responses: { 200: briefingSchema },
    summary:
      'Business health score (formula health-v1) with its three biggest contributors and trend, risk cards, deadlines in the next 7 days, highlights and the owner’s unresolved escalations. Same access and filters as the command center.',
  },
  projectRisks: {
    method: 'GET',
    path: '/projects/:id/risks',
    pathParams: idParams,
    responses: { 200: projectRisksSchema },
    summary:
      'Risk cards for one project: what is happening, the forecast slip, the next action, who acts and when it escalates.',
  },
  leaveCoverSuggestions: {
    method: 'GET',
    path: '/leave/requests/:id/cover-suggestions',
    pathParams: idParams,
    responses: { 200: coverSuggestionsSchema },
    summary:
      'Who could take each affected task while the person is away (same role or designation, project membership, free time). Only tasks on projects the viewer manages; never reassigns anything.',
  },
});
