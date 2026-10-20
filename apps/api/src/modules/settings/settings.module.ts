import {
  type ApplicationStores,
  ManageSettingsCommands,
  type UnitOfWork,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import { AuditController } from './audit.controller';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController, AuditController],
  providers: [
    {
      provide: ManageSettingsCommands,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new ManageSettingsCommands(uow),
    },
  ],
})
export class SettingsModule {}
