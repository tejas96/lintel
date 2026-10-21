import {
  type ApplicationStores,
  GuidanceCommands,
  type UnitOfWork,
  UpdateOwnProfileCommand,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Module } from '@nestjs/common';
import { CLOCK, UNIT_OF_WORK } from '../../infrastructure/tokens';
import { ProfileController } from './profile.controller';

@Module({
  controllers: [ProfileController],
  providers: [
    {
      provide: UpdateOwnProfileCommand,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new UpdateOwnProfileCommand(uow),
    },
    {
      provide: GuidanceCommands,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (uow: UnitOfWork<ApplicationStores>, clock: Clock) =>
        new GuidanceCommands(uow, clock),
    },
  ],
})
export class ProfileModule {}
