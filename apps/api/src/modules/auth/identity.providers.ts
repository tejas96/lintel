import {
  type ApplicationStores,
  AuthenticateSessionQuery,
  DEFAULT_OTP_POLICY,
  type OtpProvider,
  type RandomSource,
  RequestOtpCommand,
  type SecretHasher,
  SessionManagement,
  type UnitOfWork,
  VerifyOtpCommand,
} from '@lintel/application';
import type { Clock } from '@lintel/shared';
import { Logger, type Provider } from '@nestjs/common';
import {
  CLOCK,
  OTP_PROVIDER,
  RANDOM_SOURCE,
  SECRET_HASHER,
  UNIT_OF_WORK,
} from '../../infrastructure/tokens';

type Stores = UnitOfWork<ApplicationStores>;

/** Wires the identity use cases to their adapters. */
export const identityProviders: Provider[] = [
  {
    provide: RequestOtpCommand,
    inject: [UNIT_OF_WORK, OTP_PROVIDER, SECRET_HASHER, RANDOM_SOURCE, CLOCK],
    useFactory: (
      uow: Stores,
      otp: OtpProvider,
      hasher: SecretHasher,
      random: RandomSource,
      clock: Clock,
    ) =>
      new RequestOtpCommand(
        uow.stores.identity,
        otp,
        hasher,
        random,
        clock,
        DEFAULT_OTP_POLICY,
        (reason) =>
          new Logger('OtpDelivery').warn(`Sign-in code could not be delivered: ${reason}`),
      ),
  },
  {
    provide: VerifyOtpCommand,
    inject: [UNIT_OF_WORK, SECRET_HASHER, RANDOM_SOURCE, CLOCK],
    useFactory: (uow: Stores, hasher: SecretHasher, random: RandomSource, clock: Clock) =>
      new VerifyOtpCommand(
        uow.stores.identity,
        uow.stores.records,
        hasher,
        random,
        clock,
        DEFAULT_OTP_POLICY,
      ),
  },
  {
    provide: AuthenticateSessionQuery,
    inject: [UNIT_OF_WORK, SECRET_HASHER, CLOCK],
    useFactory: (uow: Stores, hasher: SecretHasher, clock: Clock) =>
      new AuthenticateSessionQuery(uow.stores.identity, hasher, clock),
  },
  {
    provide: SessionManagement,
    inject: [UNIT_OF_WORK, CLOCK],
    useFactory: (uow: Stores, clock: Clock) =>
      new SessionManagement(uow.stores.identity, uow.stores.records, clock),
  },
];
