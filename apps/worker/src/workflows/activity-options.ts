import type { ActivityOptions } from '@temporalio/workflow';

/**
 * Database reads and notification writes. They are idempotent (dedupe keys),
 * so Temporal may retry them for as long as the database is unavailable.
 */
export const DATABASE_ACTIVITY: ActivityOptions = {
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '2 seconds',
    backoffCoefficient: 2,
    maximumInterval: '5 minutes',
  },
};

/** Push sends: retryable provider failures back off and give up after six attempts. */
export const PUSH_ACTIVITY: ActivityOptions = {
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '5 seconds',
    backoffCoefficient: 2,
    maximumInterval: '2 minutes',
    maximumAttempts: 6,
  },
};

/** Daily batch work over every active project. */
export const BATCH_ACTIVITY: ActivityOptions = {
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '10 seconds',
    backoffCoefficient: 2,
    maximumInterval: '5 minutes',
    maximumAttempts: 10,
  },
};
