import type { CalendarDate } from '@lintel/shared';
import { DOCUMENT_FOLDER_LABELS, type DocumentFolder } from '../documents/document-rules';
import { formatRewardDate } from './milestone-reward.rules';

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/**
 * What earns a milestone reward, in plain words, in the order the rules
 * check it. Shown to the people it is for before the milestone completes.
 */
export function describeMilestoneRewardConditions(input: {
  readonly agreedDueDate: CalendarDate;
  readonly requiredFolders: readonly DocumentFolder[];
  readonly sharedBy: number;
}): string[] {
  const conditions = [
    'Every required deliverable of the milestone’s tasks is submitted.',
    'Each of them is approved in review.',
    `The milestone is completed by ${formatRewardDate(input.agreedDueDate)}, or by a later date set by an approved scope change. Waiting on a client, a supplier, a decision or a colleague is not counted as lateness.`,
  ];
  if (input.requiredFolders.length > 0) {
    const folders = joinWords(
      input.requiredFolders.map((folder) => DOCUMENT_FOLDER_LABELS[folder]),
    );
    conditions.push(
      `${folders} ${input.requiredFolders.length === 1 ? 'is' : 'are'} in the project documents.`,
    );
  }
  conditions.push(
    input.sharedBy > 1
      ? `Shared equally by ${input.sharedBy} people. A reviewer confirms each share; nothing is paid or deducted automatically.`
      : 'A reviewer confirms the reward; nothing is paid or deducted automatically.',
  );
  return conditions;
}
