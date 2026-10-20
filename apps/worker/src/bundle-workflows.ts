import { writeFile } from 'node:fs/promises';
import { bundleWorkflowCode } from '@temporalio/worker';
import { WORKFLOW_BUNDLE_PATH, WORKFLOWS_PATH } from './workflow-source';

/**
 * Prebuilds the workflow bundle for production (`pnpm build && pnpm bundle`),
 * so workers start fast and every replica runs byte-identical workflow code.
 */
async function main(): Promise<void> {
  const { code } = await bundleWorkflowCode({ workflowsPath: WORKFLOWS_PATH });
  await writeFile(WORKFLOW_BUNDLE_PATH, code);
  console.info(`Workflow bundle written to ${WORKFLOW_BUNDLE_PATH} (${code.length} bytes).`);
}

main().catch((error: unknown) => {
  console.error('Bundling workflows failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
