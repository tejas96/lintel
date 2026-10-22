import type { Actor } from '@lintel/domain';
import { NotFoundError, PreconditionFailedError } from '@lintel/shared';
import { ProjectAccessService } from '../access/project-access.service';
import type { ApplicationStores } from '../common/unit-of-work';
import { type DateChangeImpact, dateChangeImpact } from './date-change-impact';

type Stores = Pick<ApplicationStores, 'access' | 'dateChanges' | 'scopeChanges' | 'settings'>;

/**
 * What accepting a new-date request would do to the rest of the plan, so the
 * decider sees it first. Missing and hidden requests answer 404.
 */
export class DateChangeImpactQuery {
  constructor(private readonly stores: Stores) {}

  async execute(actor: Actor, requestId: string): Promise<DateChangeImpact> {
    const request = await this.stores.dateChanges.find(requestId);
    if (!request) throw new NotFoundError('New-date request');
    await new ProjectAccessService(this.stores.access).requireView(
      actor,
      request.projectId,
      'New-date request',
    );
    const facts = await this.stores.scopeChanges.scheduleFacts(request.projectId);
    if (!facts) throw new PreconditionFailedError('The project has no schedule yet.');
    return dateChangeImpact(facts, request, await this.stores.settings.defaultCalendar());
  }
}
