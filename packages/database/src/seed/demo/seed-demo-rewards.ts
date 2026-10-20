import { ManageRewardPoliciesCommands, RunRewardEvaluationCommand } from '@lintel/application';
import { eq } from 'drizzle-orm';
import type { Database } from '../../client';
import { rewardPolicies } from '../../schema';
import type { DemoContext } from './demo-context';

const POLICY_NAME = 'Reliable delivery bonus';

/**
 * An example reward policy (amounts are placeholders the studio must set) and
 * an evaluation of the current month, so the rewards screens have real,
 * explained results. Created once; reruns leave decided evaluations alone.
 */
export async function seedDemoRewards(db: Database, context: DemoContext): Promise<boolean> {
  const [existing] = await db
    .select({ id: rewardPolicies.id })
    .from(rewardPolicies)
    .where(eq(rewardPolicies.name, POLICY_NAME));
  if (existing) return false;
  const owner = await context.actingAs('owner');
  const policy = await new ManageRewardPoliciesCommands(context.deps.uow).create(owner, {
    name: POLICY_NAME,
    description:
      'Monthly recognition for dependable, first-time-right delivery. Example amount — set your own.',
    scope: 'individual',
    period: 'monthly',
    criteria: [
      { type: 'on_time_delivery_rate', minimumRate: 0.85, minimumTasks: 3 },
      { type: 'first_pass_approval_rate', minimumRate: 0.6, minimumReviews: 1 },
      { type: 'process_compliance_rate', minimumRate: 0.8, minimumTasks: 3 },
    ],
    amountMinor: 3_000_00,
    isActive: true,
  });
  const periodStart = `${context.today.slice(0, 7)}-01`;
  await new RunRewardEvaluationCommand(context.deps.uow, context.deps.clock).execute(
    owner,
    policy.id,
    periodStart,
  );
  return true;
}
