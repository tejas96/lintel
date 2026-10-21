import {
  type ApplicationStores,
  DecideMilestoneRewardCommand,
  PlanMilestoneRewardCommand,
  ProjectAccessService,
  RaiseRewardChallengeCommand,
  ResolveRewardChallengeCommand,
  type UnitOfWork,
  WithdrawMilestoneRewardCommand,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import type { Provider } from '@nestjs/common';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { notifierFactory } from '../leave/leave.providers';

type Stores = UnitOfWork<ApplicationStores>;
const withNotifier = [UNIT_OF_WORK, CLOCK, BusinessContextService];

export const rewardRecordsProviders: Provider[] = [
  {
    provide: ProjectAccessService,
    inject: [UNIT_OF_WORK],
    useFactory: (uow: Stores) => new ProjectAccessService(uow.stores.access),
  },
  {
    provide: PlanMilestoneRewardCommand,
    inject: withNotifier,
    useFactory: (uow: Stores, clock: Clock, business: BusinessContextService) =>
      new PlanMilestoneRewardCommand(uow, notifierFactory(clock, business)),
  },
  {
    provide: WithdrawMilestoneRewardCommand,
    inject: withNotifier,
    useFactory: (uow: Stores, clock: Clock, business: BusinessContextService) =>
      new WithdrawMilestoneRewardCommand(uow, clock, notifierFactory(clock, business)),
  },
  {
    provide: DecideMilestoneRewardCommand,
    inject: withNotifier,
    useFactory: (uow: Stores, clock: Clock, business: BusinessContextService) =>
      new DecideMilestoneRewardCommand(uow, clock, notifierFactory(clock, business)),
  },
  {
    provide: RaiseRewardChallengeCommand,
    inject: withNotifier,
    useFactory: (uow: Stores, clock: Clock, business: BusinessContextService) =>
      new RaiseRewardChallengeCommand(uow, notifierFactory(clock, business)),
  },
  {
    provide: ResolveRewardChallengeCommand,
    inject: withNotifier,
    useFactory: (uow: Stores, clock: Clock, business: BusinessContextService) =>
      new ResolveRewardChallengeCommand(uow, clock, notifierFactory(clock, business)),
  },
];
