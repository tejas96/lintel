/** Starts or signals durable workflows. Implemented with the Temporal client. */
export interface WorkflowScheduler {
  /** Idempotent: starting an already-running workflow ID returns without error. */
  start(request: WorkflowStartRequest): Promise<void>;
  signalWithStart(
    request: WorkflowStartRequest & { signal: string; signalArgs: unknown[] },
  ): Promise<void>;
  /**
   * Signals a running workflow and never starts one. Resolves false when no
   * workflow with that ID is running.
   */
  signal(request: WorkflowSignalRequest): Promise<boolean>;
  checkHealth(): Promise<boolean>;
}

export interface WorkflowStartRequest {
  readonly workflowType: string;
  readonly workflowId: string;
  readonly args: unknown[];
}

export interface WorkflowSignalRequest {
  readonly workflowId: string;
  readonly signal: string;
  readonly signalArgs: unknown[];
}
