import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Written by `pnpm --filter @lintel/worker bundle` (see bundle-workflows.ts). */
export const WORKFLOW_BUNDLE_PATH = join(__dirname, 'workflow-bundle.js');

export const WORKFLOWS_PATH = require.resolve('./workflows');

export type WorkflowSource =
  | { readonly workflowBundle: { readonly codePath: string } }
  | { readonly workflowsPath: string };

/**
 * Production note: prebuild the workflow bundle with `bundleWorkflowCode`
 * (`pnpm build && pnpm --filter @lintel/worker bundle`) so every replica runs
 * identical workflow code and starts without webpack. In development the
 * worker bundles `src/workflows` itself at startup, so edits are never stale.
 */
export function workflowSource(nodeEnv: string): WorkflowSource {
  if (nodeEnv === 'production' && existsSync(WORKFLOW_BUNDLE_PATH)) {
    return { workflowBundle: { codePath: WORKFLOW_BUNDLE_PATH } };
  }
  return { workflowsPath: WORKFLOWS_PATH };
}
