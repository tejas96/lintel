import {
  type Capability,
  createWorkflowTemplatePreset,
  DEFAULT_ROLE_CAPABILITIES,
  type Role,
  type WorkflowTemplateDefinition,
} from '@lintel/domain';
import { type ApplicationError, fixedClock } from '@lintel/shared';
import { describe, expect, it } from 'vitest';
import type { AuditEntry, RecordStore } from '../common/record.store';
import type { RequestContext } from '../common/request-context';
import { InMemoryTemplateStore } from '../testing/in-memory-template.store';
import { ManageTemplatesCommands } from './manage-templates.commands';

function contextFor(role: Role): RequestContext {
  const capabilities = new Set<Capability>(DEFAULT_ROLE_CAPABILITIES[role]);
  return { actor: { userId: `${role}-1`, role, capabilities }, sessionId: 's', requestId: 'r' };
}

function setup() {
  const templates = new InMemoryTemplateStore();
  const audits: AuditEntry[] = [];
  const records: RecordStore = {
    appendActivity: async () => {},
    appendAudit: async (entry) => {
      audits.push(entry);
    },
    enqueueEvent: async () => {},
  };
  const stores = { templates, records };
  const uow = { stores, transaction: <T>(work: (s: typeof stores) => Promise<T>) => work(stores) };
  const commands = new ManageTemplatesCommands(uow, fixedClock('2026-10-21T05:00:00Z'));
  return { templates, audits, commands, manager: contextFor('project_manager') };
}

async function failure(promise: Promise<unknown>): Promise<ApplicationError> {
  try {
    await promise;
  } catch (error) {
    return error as ApplicationError;
  }
  throw new Error('Expected the command to fail.');
}

const preset = createWorkflowTemplatePreset('other').definition;

describe('template authoring', () => {
  it('starts a new template as a draft copy of the built-in preset', async () => {
    const { templates, commands, manager } = setup();
    const { id } = await commands.create(manager, {
      name: 'Small studio jobs',
      description: null,
      projectType: 'other',
      copyFromVersionId: null,
    });
    const [draft] = await templates.versionsOf(id);
    expect(draft?.status).toBe('draft');
    expect(draft?.versionNumber).toBe(1);
    expect(draft?.definition).toEqual(preset);
  });

  it('only lets people with templates.manage author templates', async () => {
    const { commands } = setup();
    const input = {
      name: 'x',
      description: null,
      projectType: 'other' as const,
      copyFromVersionId: null,
    };
    expect((await failure(commands.create(contextFor('employee'), input))).code).toBe('FORBIDDEN');
  });

  it('publishes the draft, retires the previous version and keeps it immutable', async () => {
    const { templates, commands, manager, audits } = setup();
    const { id } = await commands.create(manager, {
      name: 'Homes',
      description: null,
      projectType: 'other',
      copyFromVersionId: null,
    });
    await commands.publish(manager, id, 1);
    const v1 = (await templates.versionsOf(id))[0];
    expect(v1?.status).toBe('published');

    const edited: WorkflowTemplateDefinition = { ...preset, stages: preset.stages.slice(0, 1) };
    await commands.saveDraft(manager, id, {
      definition: edited,
      changeNotes: 'Shorter',
      expectedVersion: null,
    });
    const afterDraft = await templates.versionsOf(id);
    expect(afterDraft.map((v) => [v.versionNumber, v.status])).toEqual([
      [1, 'published'],
      [2, 'draft'],
    ]);
    expect(afterDraft[0]?.definition).toEqual(preset);

    const draft = afterDraft[1];
    await commands.publish(manager, id, draft?.version ?? 0);
    const final = await templates.versionsOf(id);
    expect(final.map((v) => v.status)).toEqual(['retired', 'published']);
    expect(audits.map((entry) => entry.action)).toContain('template.published');
  });

  it('rejects stale drafts and publishing when there is no draft', async () => {
    const { commands, manager } = setup();
    const { id } = await commands.create(manager, {
      name: 'Homes',
      description: null,
      projectType: 'other',
      copyFromVersionId: null,
    });
    const stale = commands.saveDraft(manager, id, {
      definition: preset,
      changeNotes: null,
      expectedVersion: null,
    });
    expect((await failure(stale)).code).toBe('STALE_VERSION');
    expect((await failure(commands.publish(manager, id, 99))).code).toBe('STALE_VERSION');
    await commands.publish(manager, id, 1);
    expect((await failure(commands.publish(manager, id, 2))).code).toBe('PRECONDITION_FAILED');
  });

  it('reports every workflow rule a draft breaks', async () => {
    const { commands, manager } = setup();
    const { id } = await commands.create(manager, {
      name: 'Homes',
      description: null,
      projectType: 'other',
      copyFromVersionId: null,
    });
    const [stage] = preset.stages;
    if (!stage) throw new Error('Preset has no stages.');
    const [first, second] = stage.tasks;
    if (!first || !second) throw new Error('Preset stage has too few tasks.');
    const broken: WorkflowTemplateDefinition = {
      options: [],
      stages: [
        {
          ...stage,
          tasks: [
            { ...first, dependsOn: [second.key] },
            { ...second, dependsOn: [first.key, 'missing-task'] },
          ],
        },
      ],
    };
    const error = await failure(
      commands.saveDraft(manager, id, {
        definition: broken,
        changeNotes: null,
        expectedVersion: 1,
      }),
    );
    expect(error.code).toBe('VALIDATION_FAILED');
    const messages = error.details.map((detail) => detail.message);
    expect(messages).toContain('Dependency "missing-task" does not exist.');
    expect(messages).toContain('Task dependencies form a loop.');
  });

  it('archived templates cannot be edited', async () => {
    const { commands, manager } = setup();
    const { id } = await commands.create(manager, {
      name: 'Homes',
      description: null,
      projectType: 'other',
      copyFromVersionId: null,
    });
    await commands.archive(manager, id);
    expect((await failure(commands.publish(manager, id, 1))).code).toBe('PRECONDITION_FAILED');
  });
});
