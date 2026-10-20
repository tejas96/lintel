import { FeatureDisabledError } from '@lintel/shared';
import type { AiAnswer, AiAssistant } from './ai-assistant.port';

/** The only AiAssistant in Phase 1. It never initialises a model client and always refuses. */
export class DisabledAiAssistant implements AiAssistant {
  readonly enabled = false;

  async answerQuestion(): Promise<AiAnswer> {
    throw new FeatureDisabledError('AI features are not enabled. They are planned for Phase 2.');
  }
}
