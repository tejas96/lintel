import { type ApplicationStores, ManageTeamsCommands, type UnitOfWork } from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { TeamsController } from './teams.controller';

@Module({
  controllers: [TeamsController],
  providers: [
    {
      provide: ManageTeamsCommands,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock) =>
        new ManageTeamsCommands(uow, clock),
    },
  ],
})
export class TeamsModule {}
