import { describe, expect, it } from 'vitest';
import { fieldLabel } from './audit-presentation';
import { inlineText } from './audit-value-text';

const TASK = 'b6daab43-1111-4222-8333-944455556666';
const names = { [TASK]: '#7 Complete civil, electrical and plumbing work' };

describe('audit values as words', () => {
  it('reads a timeline move with the task name and date ranges', () => {
    const moves = [
      {
        to: ['2026-11-14', '2026-11-25'],
        from: ['2026-11-14', '2026-11-27'],
        taskId: TASK,
        isDownstream: false,
      },
    ];
    expect(inlineText('moves', moves, names)).toBe(
      '#7 Complete civil, electrical and plumbing work: 14 Nov–27 Nov → 14 Nov–25 Nov',
    );
  });

  it('never shows raw JSON for unknown records', () => {
    expect(inlineText('change', { budgetMinor: 250_000_000, approved: true }, {})).toBe(
      'Budget: ₹25,00,000 · Approved: Yes',
    );
  });

  it('names unknown ids briefly instead of printing the UUID', () => {
    expect(inlineText('ownerUserId', '0b8c1f9e-1111-4222-8333-944455556666', {})).toBe(
      'Record 0b8c1f9e',
    );
  });

  it('labels fields without id and minor-unit suffixes', () => {
    expect(fieldLabel('taskIds')).toBe('Tasks');
    expect(fieldLabel('ownerUserId')).toBe('Owner user');
    expect(fieldLabel('budgetMinor')).toBe('Budget');
  });
});
