import type { ApplicationStores } from '../common/unit-of-work';
import type { Notifier } from './notifier';

/**
 * Builds a Notifier bound to the given (usually transactional) stores, so
 * notifications commit together with the change that caused them.
 */
export type NotifierFactory = (
  stores: Pick<ApplicationStores, 'notifications' | 'records'>,
) => Promise<Notifier>;
