import type { WorkflowScheduler, WorkflowStartRequest } from '@lintel/application';
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';

export interface TemporalConfiguration {
  readonly address: string;
  readonly namespace: string;
  readonly taskQueue: string;
}

/**
 * Starts workflows by type name, so the API does not import workflow code.
 * Workflow IDs are derived from business records, which makes every start
 * idempotent: a second start for a running ID is a no-op.
 */
export class TemporalWorkflowScheduler implements WorkflowScheduler {
  private clientPromise: Promise<Client> | null = null;

  constructor(private readonly config: TemporalConfiguration) {}

  private client(): Promise<Client> {
    this.clientPromise ??= Connection.connect({ address: this.config.address }).then(
      (connection) => new Client({ connection, namespace: this.config.namespace }),
    );
    return this.clientPromise;
  }

  async start(request: WorkflowStartRequest): Promise<void> {
    const client = await this.client();
    try {
      await client.workflow.start(request.workflowType, {
        workflowId: request.workflowId,
        taskQueue: this.config.taskQueue,
        args: request.args,
        workflowIdConflictPolicy: 'USE_EXISTING',
      });
    } catch (error) {
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
    }
  }

  async signalWithStart(request: WorkflowStartRequest & { signal: string; signalArgs: unknown[] }) {
    const client = await this.client();
    await client.workflow.signalWithStart(request.workflowType, {
      workflowId: request.workflowId,
      taskQueue: this.config.taskQueue,
      args: request.args,
      signal: request.signal,
      signalArgs: request.signalArgs,
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const client = await this.client();
      await client.workflowService.getSystemInfo({});
      return true;
    } catch {
      this.clientPromise = null;
      return false;
    }
  }
}
