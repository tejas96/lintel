import {
  type ApplicationStores,
  CancelLeaveRequestCommand,
  DecideHandoverCommand,
  DecideLeaveRequestCommands,
  type LeaveDependencies,
  LeaveQueries,
  Notifier,
  type NotifierFactory,
  PeopleAwayQuery,
  RecordUrgentAbsenceCommand,
  RequestLeaveCommands,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import type { Provider } from '@nestjs/common';
import { BusinessContextService } from '../../infrastructure/business-context.service';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';

/** A Notifier bound to the transaction's stores, with the studio's quiet-hour defaults. */
export function notifierFactory(clock: Clock, business: BusinessContextService): NotifierFactory {
  return async (stores) =>
    new Notifier(stores.notifications, stores.records, clock, await business.notifierDefaults());
}

export const LEAVE_DEPENDENCIES = Symbol('LEAVE_DEPENDENCIES');

const leaveCommand = <T>(type: new (deps: LeaveDependencies) => T): Provider => ({
  provide: type,
  inject: [LEAVE_DEPENDENCIES],
  useFactory: (deps: LeaveDependencies) => new type(deps),
});

export const leaveProviders: Provider[] = [
  {
    provide: LEAVE_DEPENDENCIES,
    inject: [UNIT_OF_WORK, CLOCK, BusinessContextService],
    useFactory: (
      uow: UnitOfWork<ApplicationStores>,
      clock: Clock,
      business: BusinessContextService,
    ): LeaveDependencies => ({ uow, clock, notifierFor: notifierFactory(clock, business) }),
  },
  leaveCommand(RequestLeaveCommands),
  leaveCommand(DecideLeaveRequestCommands),
  leaveCommand(CancelLeaveRequestCommand),
  leaveCommand(RecordUrgentAbsenceCommand),
  leaveCommand(DecideHandoverCommand),
  {
    provide: LeaveQueries,
    inject: [UNIT_OF_WORK, CLOCK],
    useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock) => new LeaveQueries(uow, clock),
  },
  {
    provide: PeopleAwayQuery,
    inject: [UNIT_OF_WORK, CLOCK],
    useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock) =>
      new PeopleAwayQuery(uow, clock),
  },
];
