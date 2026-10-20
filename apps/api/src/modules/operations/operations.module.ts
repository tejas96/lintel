import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { CommandCenterController } from './command-center.controller';
import { NotificationsController } from './notifications.controller';
import { operationsProviders } from './operations.providers';
import { RewardsController } from './rewards.controller';

/**
 * Capacity, command center, notifications, rewards and the approval queue.
 * The audit log route of the same contract is served by another module.
 */
@Module({
  controllers: [
    CommandCenterController,
    NotificationsController,
    RewardsController,
    ApprovalsController,
  ],
  providers: [...operationsProviders],
})
export class OperationsModule {}
