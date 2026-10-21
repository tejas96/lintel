import type { CoverSuggestionsResult } from '@lintel/application';
import type { CalendarDate } from '@lintel/shared';
import { inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../client';
import { tasks } from '../../schema';
import { loadTaskSummaries } from '../shared/task-summary.query';
import { loadUserSummaries, pickUser } from '../shared/user-summary.query';

/** Cover suggestions with the tasks and people resolved for the apps. */
export async function toCoverSuggestionsView(
  db: DatabaseExecutor,
  result: CoverSuggestionsResult,
  today: CalendarDate,
) {
  const taskIds = result.tasks.map((item) => item.taskId);
  const [summaries, people] = await Promise.all([
    taskIds.length > 0
      ? loadTaskSummaries(db, { where: inArray(tasks.id, taskIds), today })
      : Promise.resolve([]),
    loadUserSummaries(
      db,
      result.tasks.flatMap((item) => [
        item.handover?.toUserId,
        ...item.suggestions.map((suggestion) => suggestion.userId),
      ]),
    ),
  ]);
  return {
    leaveRequestId: result.leaveRequestId,
    tasks: result.tasks.flatMap((item) => {
      const summary = summaries.find((candidate) => candidate.id === item.taskId);
      if (!summary) return [];
      const { projectCriticality: _criticality, ...task } = summary;
      return [
        {
          task,
          window: item.window,
          remainingMinutes: item.remainingMinutes,
          handover: item.handover
            ? {
                id: item.handover.id,
                status: item.handover.status,
                to: pickUser(people, item.handover.toUserId),
              }
            : null,
          suggestions: item.suggestions.flatMap((suggestion) => {
            const user = people.get(suggestion.userId);
            return user
              ? [
                  {
                    user,
                    score: suggestion.score,
                    freeMinutes: suggestion.freeMinutes,
                    hasRoom: suggestion.hasRoom,
                    reasons: [...suggestion.reasons],
                  },
                ]
              : [];
          }),
        },
      ];
    }),
  };
}
