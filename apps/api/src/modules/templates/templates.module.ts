import {
  type ApplicationStores,
  ManageTemplatesCommands,
  type UnitOfWork,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { TemplatesController } from './templates.controller';

@Module({
  controllers: [TemplatesController],
  providers: [
    {
      provide: ManageTemplatesCommands,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock) =>
        new ManageTemplatesCommands(uow, clock),
    },
  ],
})
export class TemplatesModule {}
