import {
  type ApplicationStores,
  ManageWorkingCalendarsCommands,
  type UnitOfWork,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import { WorkingCalendarsController } from './working-calendars.controller';

@Module({
  controllers: [WorkingCalendarsController],
  providers: [
    {
      provide: ManageWorkingCalendarsCommands,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new ManageWorkingCalendarsCommands(uow),
    },
  ],
})
export class WorkingCalendarsModule {}
