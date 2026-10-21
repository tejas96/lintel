import { describe, expect, it } from 'vitest';
import { fieldsToApply, itemWillApply, planTemplateUpdate } from './template-update.diff';
import { PROJECT, UPDATE_INPUT } from './template-update.fixtures';
import type { SnapshotTask, TemplateItemChange } from './template-update.types';

function changeTo(key: string, status?: SnapshotTask['status']): TemplateItemChange {
  const tasks = PROJECT.tasks.map((task) =>
    status && task.templateKey === key.replace('task:', '') ? { ...task, status } : task,
  );
  const plan = planTemplateUpdate({ ...UPDATE_INPUT, project: { ...PROJECT, tasks } });
  const found = plan.items.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`No change for ${key}`);
  return found;
}

describe('template update preview: work that never changes', () => {
  it('never changes finished work, even when ticked', () => {
    const handover = changeTo('task:handover');
    expect(handover.blocked?.reason).toBe('Finished work stays as it was recorded.');
    expect(fieldsToApply(handover, new Set([handover.key]))).toEqual([]);
  });

  it('never changes work waiting for review, even when ticked', () => {
    const brief = changeTo('task:brief', 'in_review');
    expect(brief.blocked?.reason).toContain('waiting for review');
    expect(brief.optIn).toBeNull();
    expect(itemWillApply(brief, new Set([brief.key]))).toBe(false);
    expect(fieldsToApply(brief, new Set([brief.key]))).toEqual([]);
  });
});
