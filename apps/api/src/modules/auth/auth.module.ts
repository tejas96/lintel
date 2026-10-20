import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { identityProviders } from './identity.providers';

@Module({
  controllers: [AuthController],
  providers: [...identityProviders],
  exports: [...identityProviders],
})
export class AuthModule {}
