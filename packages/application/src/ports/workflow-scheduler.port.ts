/** Starts or signals durable workflows. Implemented with the Temporal client. */
export interface WorkflowScheduler {
  /** Idempotent: starting an already-running workflow ID returns without error. */
  start(request: WorkflowStartRequest): Promise<void>;
  signalWithStart(
    request: WorkflowStartRequest & { signal: string; signalArgs: unknown[] },
  ): Promise<void>;
  checkHealth(): Promise<boolean>;
}

export interface WorkflowStartRequest {
  readonly workflowType: string;
  readonly workflowId: string;
  readonly args: unknown[];
}
