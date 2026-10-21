import {
  type ApplicationStores,
  type UnitOfWork,
  UpdateOwnProfileCommand,
} from '@lintel/application';
import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import { ProfileController } from './profile.controller';

@Module({
  controllers: [ProfileController],
  providers: [
    {
      provide: UpdateOwnProfileCommand,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork<ApplicationStores>) => new UpdateOwnProfileCommand(uow),
    },
  ],
})
export class ProfileModule {}
