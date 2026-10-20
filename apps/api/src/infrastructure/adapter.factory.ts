import type {
  FeatureFlags,
  ObjectStorage,
  OtpProvider,
  PushProvider,
  RandomSource,
} from '@lintel/application';
import type { Environment } from '@lintel/configuration';
import {
  CryptoRandomSource,
  FirebasePushProvider,
  FixedCodeRandomSource,
  LocalDevelopmentOtpProvider,
  LogPushProvider,
  Msg91OtpProvider,
  RustFsObjectStorage,
} from '@lintel/integrations';
import { Logger } from '@nestjs/common';

/**
 * Chooses adapters from validated configuration (Factory pattern). Production
 * safety is already enforced by `loadEnvironment`, and every development
 * adapter also refuses to start in production on its own.
 */
export const adapterFactory = {
  otpProvider(env: Environment): OtpProvider {
    if (env.OTP_PROVIDER === 'msg91' && env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID) {
      return new Msg91OtpProvider({
        baseUrl: env.MSG91_BASE_URL,
        authKey: env.MSG91_AUTH_KEY,
        templateId: env.MSG91_TEMPLATE_ID,
        timeoutMs: env.MSG91_TIMEOUT_MS,
      });
    }
    return new LocalDevelopmentOtpProvider(new Logger('LocalOtp'), env.NODE_ENV);
  },

  randomSource(env: Environment): RandomSource {
    if (env.OTP_DEVELOPMENT_CODE && env.NODE_ENV !== 'production') {
      return new FixedCodeRandomSource(env.OTP_DEVELOPMENT_CODE);
    }
    return new CryptoRandomSource();
  },

  objectStorage(env: Environment): RustFsObjectStorage {
    return new RustFsObjectStorage({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      bucket: env.STORAGE_BUCKET,
      accessKey: env.STORAGE_ACCESS_KEY,
      secretKey: env.STORAGE_SECRET_KEY,
    });
  },

  pushProvider(env: Environment): PushProvider {
    if (
      env.PUSH_PROVIDER === 'fcm' &&
      env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY
    ) {
      return new FirebasePushProvider({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      });
    }
    return new LogPushProvider(new Logger('Push'));
  },

  featureFlags(env: Environment): FeatureFlags {
    return { aiFeaturesEnabled: false, smsNotificationsEnabled: env.SMS_NOTIFICATIONS_ENABLED };
  },
};

export type { ObjectStorage };
