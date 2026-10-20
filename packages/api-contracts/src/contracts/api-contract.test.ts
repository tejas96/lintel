import { type AppRoute, type AppRouter, initContract, isAppRoute } from '@ts-rest/core';
import { describe, expect, it } from 'vitest';
import { errorResponseSchema } from '../common/errors';
import { calendarDateSchema } from '../common/primitives';
import { apiContractOptions, apiRouterDefinition } from './index';

const contract = initContract().router(apiRouterDefinition, apiContractOptions);

function routesOf(router: AppRouter): AppRoute[] {
  return Object.values(router).flatMap((entry) => (isAppRoute(entry) ? [entry] : routesOf(entry)));
}

describe('API contract', () => {
  const routes = routesOf(contract);

  it('versions every route under /v1', () => {
    expect(routes.length).toBeGreaterThan(80);
    for (const route of routes) expect(route.path.startsWith('/v1/')).toBe(true);
  });

  it('never defines the same method and path twice', () => {
    const keys = routes.map((route) => `${route.method} ${route.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('documents the shared error shape on every route', () => {
    for (const route of routes) {
      expect(route.responses[401]).toBe(errorResponseSchema);
      expect(route.responses[500]).toBe(errorResponseSchema);
    }
  });

  it('accepts real calendar dates only', () => {
    expect(calendarDateSchema.safeParse('2026-02-28').success).toBe(true);
    expect(calendarDateSchema.safeParse('2026-02-30').success).toBe(false);
  });
});
