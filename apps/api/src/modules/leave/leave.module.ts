import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { leaveProviders } from './leave.providers';

@Module({
  controllers: [LeaveController],
  providers: [...leaveProviders],
})
export class LeaveModule {}
