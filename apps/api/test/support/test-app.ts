import 'reflect-metadata';
import { loadEnvironment } from '@lintel/configuration';
import {
  createDatabaseConnection,
  type DatabaseConnection,
  seedFoundation,
} from '@lintel/database';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { applyTestEnvironment, TEST_DATABASE_URL } from './test-environment';

export interface TestApp {
  readonly app: NestExpressApplication;
  readonly http: ReturnType<typeof request>;
  /** Direct database access for arranging state and asserting side effects. */
  readonly database: DatabaseConnection;
  close(): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  applyTestEnvironment();
  const env = loadEnvironment();
  const database = createDatabaseConnection(TEST_DATABASE_URL, { max: 2 });
  await seedFoundation(database.db);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, env);
  await app.init();
  return {
    app,
    http: request(app.getHttpServer()),
    database,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

/**
 * Signs in through the public API (mobile-style bearer session). Clears the
 * person's sign-in throttling first so tests can sign in repeatedly.
 */
export async function signInAs(testApp: TestApp, nationalNumber: string): Promise<string> {
  const phone = `+91${nationalNumber}`;
  await testApp.database.pool.query('DELETE FROM otp_challenges WHERE phone_e164 = $1', [phone]);
  await testApp.database.pool.query("DELETE FROM rate_limit_counters WHERE key LIKE 'otp-%'");
  await testApp.http
    .post('/v1/auth/otp/request')
    .send({ countryCallingCode: '91', nationalNumber })
    .expect(200);
  const response = await testApp.http
    .post('/v1/auth/otp/verify')
    .send({ countryCallingCode: '91', nationalNumber, code: '123456', client: 'mobile' })
    .expect(200);
  return response.body.sessionToken as string;
}

export const PEOPLE = {
  owner: '9000000001',
  administrator: '9000000002',
  projectManager: '9000000003',
  teamLead: '9000000005',
  employee: '9000000006',
  siteSupervisor: '9000000010',
} as const;
