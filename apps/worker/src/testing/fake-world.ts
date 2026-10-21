import type {
  UnitOfWork,
  WorkflowScheduler,
  WorkflowSignalRequest,
  WorkflowStartRequest,
} from '@lintel/application';
import { fixedClock } from '@lintel/shared';
import {
  type ActivityDependencies,
  type MessageChannelDependencies,
  OrganizationContext,
  type WorkerStores,
} from '../activities';
import { silentLogger } from '../observability/worker-logger';
import {
  FakeDailyOperationsStore,
  FakeFollowUpStore,
  FakeLeaveImpactStore,
  FakeOutboxRelayStore,
  FakeWorkflowRunStore,
} from './fake-background-stores';
import { FakeEmailDigestStore } from './fake-email-digests';
import { FakeMessageDeliveryStore, ScriptedEmailSender, ScriptedSmsSender } from './fake-messages';
import {
  FakeNotificationStore,
  FakeRecordStore,
  FakeSettingsStore,
} from './fake-notification-stores';
import { FakePushDeliveryStore, ScriptedPushProvider } from './fake-push';

export class FakeUnitOfWork<TStores> implements UnitOfWork<TStores> {
  transactions = 0;
  constructor(readonly stores: TStores) {}
  async transaction<T>(work: (stores: TStores) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return work(this.stores);
  }
}

type Call =
  | { readonly kind: 'start'; readonly request: WorkflowStartRequest }
  | {
      readonly kind: 'signalWithStart';
      readonly request: WorkflowStartRequest;
      readonly signal: string;
    }
  | { readonly kind: 'signal'; readonly request: WorkflowSignalRequest };

/** Records calls; `failFor` makes a workflow ID throw, `running` controls `signal`. */
export class FakeWorkflowScheduler implements WorkflowScheduler {
  readonly calls: Call[] = [];
  readonly failFor = new Set<string>();
  readonly running = new Set<string>();

  private check(workflowId: string) {
    if (this.failFor.has(workflowId)) throw new Error(`Temporal unavailable for ${workflowId}`);
  }
  async start(request: WorkflowStartRequest) {
    this.check(request.workflowId);
    this.calls.push({ kind: 'start', request });
  }
  async signalWithStart(request: WorkflowStartRequest & { signal: string; signalArgs: unknown[] }) {
    this.check(request.workflowId);
    this.calls.push({ kind: 'signalWithStart', request, signal: request.signal });
  }
  async signal(request: WorkflowSignalRequest) {
    this.check(request.workflowId);
    this.calls.push({ kind: 'signal', request });
    return this.running.has(request.workflowId);
  }
  async checkHealth() {
    return true;
  }
}

/** Every fake wired together, with a clock fixed at `now`. */
export function createFakeWorld(now = '2026-11-09T06:00:00.000Z') {
  const stores = {
    notifications: new FakeNotificationStore(),
    records: new FakeRecordStore(),
    settings: new FakeSettingsStore(),
    background: {
      outbox: new FakeOutboxRelayStore(),
      workflowRuns: new FakeWorkflowRunStore(),
      followUps: new FakeFollowUpStore(),
      leaveImpact: new FakeLeaveImpactStore(),
      pushDeliveries: new FakePushDeliveryStore(),
      operations: new FakeDailyOperationsStore(),
      messageDeliveries: new FakeMessageDeliveryStore(),
      emailDigests: new FakeEmailDigestStore(),
    },
  } satisfies WorkerStores;
  const uow = new FakeUnitOfWork(stores);
  const clock = fixedClock(now);
  const push = new ScriptedPushProvider();
  const scheduler = new FakeWorkflowScheduler();
  const organization = new OrganizationContext(stores.settings, clock, { smsConfigured: false });
  const deps: ActivityDependencies = {
    uow,
    clock,
    push,
    scheduler,
    organization,
    logger: silentLogger,
  };
  const sms = new ScriptedSmsSender();
  const email = new ScriptedEmailSender();
  const channels: MessageChannelDependencies = {
    sms,
    email,
    webBaseUrl: 'https://studio.example.com',
  };
  return { stores, uow, clock, push, scheduler, deps, sms, email, channels };
}
