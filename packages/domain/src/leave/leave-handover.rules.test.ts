import { toCalendarDate } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import { isUnrelatedProjectRole } from './cover-suggestion.strategy';
import {
  handoverApplyProblem,
  isHandedBack,
  isHandoverSuperseded,
  taskOwnershipWindow,
} from './leave-handover.rules';

const sameer = 'sameer';
const priya = 'priya';

describe('handover supersession', () => {
  const applied = { status: 'applied' as const, toUserId: priya, absentUserId: sameer };

  it('stays current while the covering colleague still owns the task', () => {
    const facts = { ...applied, taskOwnerUserId: priya };
    expect(isHandoverSuperseded(facts)).toBe(false);
    expect(isHandedBack(facts)).toBe(false);
    expect(handoverApplyProblem(facts)).toBe('This handover was already applied.');
  });

  it('reads as handed back once the task is with the person on leave again', () => {
    const facts = { ...applied, taskOwnerUserId: sameer };
    expect(isHandoverSuperseded(facts)).toBe(true);
    expect(isHandedBack(facts)).toBe(true);
    expect(handoverApplyProblem(facts)).toBeNull();
  });

  it('is superseded but not reopened when someone else took the task', () => {
    const facts = { ...applied, taskOwnerUserId: 'ravi' };
    expect(isHandoverSuperseded(facts)).toBe(true);
    expect(isHandedBack(facts)).toBe(false);
    expect(handoverApplyProblem(facts)).not.toBeNull();
  });

  it('never treats an unapplied handover as superseded', () => {
    const facts = { ...applied, status: 'accepted' as const, taskOwnerUserId: sameer };
    expect(isHandoverSuperseded(facts)).toBe(false);
    expect(handoverApplyProblem(facts)).toBeNull();
  });
});

describe('task ownership window', () => {
  const today = toCalendarDate('2026-10-22');

  it('runs from the later of today and the planned start to the due date', () => {
    expect(
      taskOwnershipWindow(
        { plannedStartDate: toCalendarDate('2026-10-28'), dueDate: toCalendarDate('2026-11-04') },
        today,
      ),
    ).toEqual({ start: '2026-10-28', end: '2026-11-04' });
    expect(
      taskOwnershipWindow({ plannedStartDate: null, dueDate: toCalendarDate('2026-11-04') }, today),
    ).toEqual({ start: '2026-10-22', end: '2026-11-04' });
  });

  it('looks two weeks ahead without a due date or when overdue', () => {
    expect(taskOwnershipWindow({ plannedStartDate: null, dueDate: null }, today)).toEqual({
      start: '2026-10-22',
      end: '2026-11-04',
    });
    expect(
      taskOwnershipWindow({ plannedStartDate: null, dueDate: toCalendarDate('2026-10-01') }, today),
    ).toEqual({ start: '2026-10-22', end: '2026-11-04' });
  });
});

describe('related project roles', () => {
  it('relates the same role and plain members, not other specialists or oversight roles', () => {
    expect(isUnrelatedProjectRole('designer', 'designer')).toBe(false);
    expect(isUnrelatedProjectRole('member', 'designer')).toBe(false);
    expect(isUnrelatedProjectRole('designer', 'member')).toBe(false);
    expect(isUnrelatedProjectRole('site_supervisor', 'member')).toBe(true);
    expect(isUnrelatedProjectRole('reviewer', 'member')).toBe(true);
    expect(isUnrelatedProjectRole('manager', 'manager')).toBe(false);
    expect(isUnrelatedProjectRole('site_supervisor', 'designer')).toBe(true);
    expect(isUnrelatedProjectRole('manager', 'architect')).toBe(true);
  });
});
