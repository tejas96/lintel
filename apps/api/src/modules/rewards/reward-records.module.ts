import { Module } from '@nestjs/common';
import { RewardRecordsController } from './reward-records.controller';
import { rewardRecordsProviders } from './reward-records.providers';

/**
 * Milestone rewards (attach, check at completion, decide) and challenges of
 * reward records. Reward policies and periodic evaluations live in the
 * operations module.
 */
@Module({
  controllers: [RewardRecordsController],
  providers: [...rewardRecordsProviders],
})
export class RewardRecordsModule {}
