import {
  CLIENT_SIGN_OFF_METHOD_LABELS,
  type ClientSignOffMethod,
  clientSignOffIssues,
  notificationDedupeKey,
} from '@lintel/domain';
import {
  ForbiddenError,
  InvalidTransitionError,
  isCalendarDate,
  NotFoundError,
  ValidationFailedError,
} from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { RequestContext } from '../common/request-context';
import type { ApplicationStores } from '../common/unit-of-work';
import { businessToday, type ProjectCommandDependencies } from '../projects/command-dependencies';
import type { ClientSignOffRecord, ScopeChangeRecord } from './scope-change.store';

export interface ClientSignOffInput {
  readonly confirmedByName: string;
  readonly method: ClientSignOffMethod;
  readonly confirmedOn: string;
  readonly note: string | null;
}

/**
 * Records how the client confirmed a proposed scope change: who, on which
 * day and how (meeting, email, call or message). The project manager or an
 * approver records it; each record is kept, and the latest one counts.
 * Approvers hear that the change is ready for their decision.
 */
export class RecordClientSignOffCommand {
  constructor(private readonly deps: ProjectCommandDependencies) {}

  async execute(
    context: RequestContext,
    scopeChangeId: string,
    input: ClientSignOffInput,
  ): Promise<{ projectId: string }> {
    return this.deps.uow.transaction(async (stores) => {
      const change = await stores.scopeChanges.findById(scopeChangeId);
      if (!change) throw new NotFoundError('Scope change');
      const access = await new ProjectAccessService(stores.access).requireView(
        context.actor,
        change.projectId,
        'Scope change',
      );
      if (!access.canManage && !context.actor.capabilities.has('scope_changes.approve')) {
        throw new ForbiddenError(
          'Only the project manager or an approver can record the client’s sign-off.',
        );
      }
      if (change.status !== 'proposed') {
        throw new InvalidTransitionError(`This scope change was already ${change.status}.`);
      }
      if (!isCalendarDate(input.confirmedOn)) {
        throw new ValidationFailedError('Use a real date.', [
          { field: 'confirmedOn', message: 'Use a real date in YYYY-MM-DD format.' },
        ]);
      }
      const signOff = {
        confirmedByName: input.confirmedByName.trim(),
        method: input.method,
        confirmedOn: input.confirmedOn,
        note: input.note?.trim() ? input.note.trim() : null,
      };
      const issues = clientSignOffIssues(signOff, await businessToday(stores, this.deps.clock));
      if (issues.length > 0) throw new ValidationFailedError('Check the sign-off.', issues);
      const record = await stores.scopeChanges.recordSignOff({
        ...signOff,
        scopeChangeId,
        recordedByUserId: context.actor.userId,
      });
      await this.write(stores, context, change, record);
      return { projectId: change.projectId };
    });
  }

  private async write(
    stores: ApplicationStores,
    context: RequestContext,
    change: ScopeChangeRecord,
    record: ClientSignOffRecord,
  ): Promise<void> {
    const how = CLIENT_SIGN_OFF_METHOD_LABELS[record.method].toLowerCase();
    await stores.records.appendActivity({
      projectId: change.projectId,
      taskId: null,
      actorUserId: context.actor.userId,
      type: 'scope_change.client_signed_off',
      summary: `Client sign-off for "${change.title}": ${record.confirmedByName} confirmed ${how} on ${record.confirmedOn}.`,
      payload: { scopeChangeId: change.id, signOffId: record.id, method: record.method },
    });
    await stores.records.appendAudit({
      actorUserId: context.actor.userId,
      action: 'scope_change.client_signed_off',
      entityType: 'scope_change',
      entityId: change.id,
      after: {
        signOffId: record.id,
        confirmedByName: record.confirmedByName,
        method: record.method,
        confirmedOn: record.confirmedOn,
        note: record.note,
      },
      requestId: context.requestId,
    });
    const approvers = (
      await stores.scopeChanges.userIdsWithCapability('scope_changes.approve')
    ).filter((userId) => userId !== context.actor.userId && userId !== change.requestedByUserId);
    if (approvers.length === 0) return;
    const notifier = await this.deps.notifierFor(stores);
    for (const userId of approvers) {
      await notifier.notify({
        recipientUserId: userId,
        kind: 'scope_change_requested',
        title: `Client signed off "${change.title}"`,
        body: `${record.confirmedByName} confirmed ${how}. It is ready for your decision.`,
        linkPath: `/projects/${change.projectId}/scope`,
        subjectType: 'scope_change',
        subjectId: change.id,
        dedupeKey: notificationDedupeKey({
          kind: 'scope_change_requested',
          recipientId: userId,
          subjectId: change.id,
          window: `sign-off:${record.id}`,
        }),
      });
    }
  }
}
