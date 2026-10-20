import { describe, expect, it } from 'vitest';
import { DisabledAiAssistant } from './disabled-ai-assistant';

describe('Phase 1 AI boundary', () => {
  it('is disabled and refuses every request with FEATURE_DISABLED', async () => {
    const assistant = new DisabledAiAssistant();
    expect(assistant.enabled).toBe(false);
    await expect(assistant.answerQuestion()).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
  });
});
