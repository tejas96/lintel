import { createDeadlineActivities } from '../activities/deadline.activities';
import { createFakeWorld } from './fake-world';
import { ADMIN, BUSINESS_OWNER, MANAGER, OWNER } from './fixtures';

/** A fake world with the deadline activities, the usual people and business owners. */
export function deadlineWorld(now?: string) {
  const fake = createFakeWorld(now);
  for (const user of [OWNER, MANAGER, BUSINESS_OWNER, ADMIN]) {
    fake.stores.notifications.activeUsers.add(user);
  }
  fake.stores.background.followUps.capabilityHolders.set('dashboard.view_business', [
    BUSINESS_OWNER,
    ADMIN,
  ]);
  return { ...fake, activities: createDeadlineActivities(fake.deps) };
}
