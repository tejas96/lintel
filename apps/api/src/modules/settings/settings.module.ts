import {
  type ApplicationStores,
  ManageSettingsCommands,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { AuditController } from './audit.controller';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController, AuditController],
  providers: [
    {
      provide: ManageSettingsCommands,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock) =>
        new ManageSettingsCommands(uow, clock),
    },
  ],
})
export class SettingsModule {}
