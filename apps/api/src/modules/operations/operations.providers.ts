import {
  type ApplicationStores,
  CapacityQuery,
  DecideRewardEvaluationCommand,
  ManageRewardPoliciesCommands,
  NotificationSettingsCommands,
  RunRewardEvaluationCommand,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import type { Provider } from '@nestjs/common';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { notifierFactory } from '../leave/leave.providers';

type Stores = UnitOfWork<ApplicationStores>;

export const operationsProviders: Provider[] = [
  {
    provide: CapacityQuery,
    inject: [UNIT_OF_WORK, CLOCK],
    useFactory: (uow: Stores, clock: Clock) => new CapacityQuery(uow, clock),
  },
  {
    provide: NotificationSettingsCommands,
    inject: [UNIT_OF_WORK, CLOCK],
    useFactory: (uow: Stores, clock: Clock) => new NotificationSettingsCommands(uow, clock),
  },
  {
    provide: ManageRewardPoliciesCommands,
    inject: [UNIT_OF_WORK],
    useFactory: (uow: Stores) => new ManageRewardPoliciesCommands(uow),
  },
  {
    provide: RunRewardEvaluationCommand,
    inject: [UNIT_OF_WORK, CLOCK],
    useFactory: (uow: Stores, clock: Clock) => new RunRewardEvaluationCommand(uow, clock),
  },
  {
    provide: DecideRewardEvaluationCommand,
    inject: [UNIT_OF_WORK, CLOCK, BusinessContextService],
    useFactory: (uow: Stores, clock: Clock, business: BusinessContextService) =>
      new DecideRewardEvaluationCommand(uow, clock, notifierFactory(clock, business)),
  },
];
