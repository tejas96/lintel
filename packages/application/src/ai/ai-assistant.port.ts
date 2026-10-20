import type { RequestContext } from '../common/request-context';

/**
 * Phase 2 boundary for AI assistance. Nothing in Phase 1 calls a model.
 * A future implementation must:
 *  - answer only from data the actor may already read (same access checks as the API),
 *  - return suggestions, never perform critical mutations itself,
 *  - route any accepted suggestion through the normal application commands,
 *  - record every prompt, data scope and accepted action in the audit log.
 * See docs/AI_PHASE_TWO.md.
 */
export interface AiAssistant {
  readonly enabled: boolean;
  answerQuestion(context: RequestContext, question: AiQuestion): Promise<AiAnswer>;
}

export interface AiQuestion {
  readonly text: string;
  /** Optional focus, e.g. a project the person is looking at. */
  readonly projectId: string | null;
}

export interface AiSuggestedAction {
  /** The application command the person could run, e.g. "tasks.assign". */
  readonly command: string;
  readonly summary: string;
  readonly requiresConfirmation: true;
}

export interface AiAnswer {
  readonly text: string;
  readonly citedRecordIds: readonly string[];
  readonly suggestedActions: readonly AiSuggestedAction[];
}
