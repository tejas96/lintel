import {
  type ApplicationStores,
  ManageLeaveTypesCommands,
  type UnitOfWork,
  UpdateLeaveRulesCommand,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import { LeavePoliciesController } from './leave-policies.controller';

@Module({
  controllers: [LeavePoliciesController],
  providers: [
    {
      provide: ManageLeaveTypesCommands,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new ManageLeaveTypesCommands(uow),
    },
    {
      provide: UpdateLeaveRulesCommand,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new UpdateLeaveRulesCommand(uow),
    },
  ],
})
export class LeavePoliciesModule {}
