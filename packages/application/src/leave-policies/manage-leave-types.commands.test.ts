import type { LeaveTypeDefinition } from '@lintel/domain';
import { describe, expect, it } from 'vitest';
import type { UnitOfWork } from '../common/unit-of-work';
import type { OrganizationSettings } from '../settings/settings.store';
import { InMemoryLeaveTypeStore } from '../testing/in-memory-leave-type.store';
import {
  contextFor,
  fakeSettings,
  person,
  RecordedEffects,
  TEST_SETTINGS,
} from '../testing/leave-test-world';
import { ManageLeaveTypesCommands } from './manage-leave-types.commands';
import { UpdateLeaveRulesCommand } from './update-leave-rules.command';

const workFromHome: LeaveTypeDefinition = {
  name: 'Work from home',
  description: '  For days at home with the laptop. ',
  requiresReason: false,
  allowsHalfDay: true,
  minimumNoticeDays: 1,
  annualAllowanceHalfDays: 20,
  colorIndex: 4,
};

const admin = contextFor(person('admin', 'administrator'));
const designer = contextFor(person('ana', 'employee'));

function setup() {
  const leaveTypes = new InMemoryLeaveTypeStore();
  const records = new RecordedEffects();
  const stores = { leaveTypes, records };
  const uow: UnitOfWork<typeof stores> = { stores, transaction: (work) => work(stores) };
  return { leaveTypes, records, commands: new ManageLeaveTypesCommands(uow) };
}

describe('leave type administration', () => {
  it('creates a type with a code from its name, trimmed and audited', async () => {
    const { commands, records } = setup();
    const created = await commands.create(admin, workFromHome);
    expect(created).toMatchObject({
      code: 'work_from_home',
      description: 'For days at home with the laptop.',
      isActive: true,
      version: 1,
    });
    expect(records.audits[0]).toMatchObject({ action: 'leave_type.created', entityId: created.id });
  });

  it('needs leave.manage_policies', async () => {
    const { commands } = setup();
    await expect(commands.create(designer, workFromHome)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('refuses invalid rules and duplicate names, field by field', async () => {
    const { commands } = setup();
    await expect(
      commands.create(admin, { ...workFromHome, minimumNoticeDays: -2, colorIndex: 7 }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'minimumNoticeDays' }, { field: 'colorIndex' }],
    });
    await commands.create(admin, workFromHome);
    await expect(
      commands.create(admin, { ...workFromHome, name: 'WORK FROM HOME' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', details: [{ field: 'name' }] });
  });

  it('edits only what changed, with the version it was opened on', async () => {
    const { commands, records } = setup();
    const created = await commands.create(admin, workFromHome);
    const edited = await commands.update(admin, created.id, {
      version: 1,
      changes: { annualAllowanceHalfDays: null, requiresReason: true },
    });
    expect(edited).toMatchObject({
      annualAllowanceHalfDays: null,
      requiresReason: true,
      version: 2,
    });
    expect(records.audits[1]).toMatchObject({
      action: 'leave_type.updated',
      before: { requiresReason: false, annualAllowanceHalfDays: 20 },
      after: { requiresReason: true, annualAllowanceHalfDays: null },
    });
    await expect(
      commands.update(admin, created.id, { version: 1, changes: { colorIndex: 1 } }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' });
  });

  it('retires and brings back types, but always keeps one active', async () => {
    const { commands, records } = setup();
    const first = await commands.create(admin, workFromHome);
    const second = await commands.create(admin, { ...workFromHome, name: 'Casual leave' });
    const retired = await commands.setActive(admin, first.id, 1, false);
    expect(retired.isActive).toBe(false);
    await expect(commands.setActive(admin, second.id, 1, false)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    const back = await commands.setActive(admin, first.id, 2, true);
    expect(back.isActive).toBe(true);
    expect(records.audits.map((audit) => audit.action)).toEqual([
      'leave_type.created',
      'leave_type.created',
      'leave_type.retired',
      'leave_type.reactivated',
    ]);
  });
});

describe('leave rules', () => {
  function rulesSetup() {
    let current: OrganizationSettings = TEST_SETTINGS;
    const records = new RecordedEffects();
    const settings = fakeSettings({
      organization: async () => current,
      updateOrganization: async (next) => {
        current = next;
        return next;
      },
    });
    const stores = { settings, records };
    const uow: UnitOfWork<typeof stores> = { stores, transaction: (work) => work(stores) };
    return { records, command: new UpdateLeaveRulesCommand(uow), current: () => current };
  }

  it('changes the second-approval threshold and nothing else', async () => {
    const { command, records, current } = rulesSetup();
    const rules = await command.execute(admin, { secondApprovalAboveHalfDays: 6 });
    expect(rules).toEqual({ secondApprovalAboveHalfDays: 6 });
    expect(current()).toEqual({ ...TEST_SETTINGS, leaveSecondApprovalAboveHalfDays: 6 });
    expect(records.audits[0]).toMatchObject({
      action: 'leave_rules.updated',
      before: { secondApprovalAboveHalfDays: 10 },
      after: { secondApprovalAboveHalfDays: 6 },
    });
  });

  it('checks the capability and the range', async () => {
    const { command } = rulesSetup();
    await expect(
      command.execute(designer, { secondApprovalAboveHalfDays: 6 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(command.execute(admin, { secondApprovalAboveHalfDays: 0 })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'secondApprovalAboveHalfDays' }],
    });
  });
});
