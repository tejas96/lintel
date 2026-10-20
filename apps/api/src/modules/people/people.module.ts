import { type ApplicationStores, ManagePeopleCommands, type UnitOfWork } from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { PeopleController } from './people.controller';

@Module({
  controllers: [PeopleController],
  providers: [
    {
      provide: ManagePeopleCommands,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock) =>
        new ManagePeopleCommands(uow, clock),
    },
  ],
})
export class PeopleModule {}
