import { apiContractOptions, apiRouterDefinition } from '@lintel/api-contracts';
import { initContract } from '@ts-rest/core';

/** The assembled API contract, exactly as the API serves it (apps/api/src/contract.ts). */
export const apiContract = initContract().router(apiRouterDefinition, apiContractOptions);

export const SESSION_COOKIE = 'lintel_session';
export const CSRF_COOKIE = 'lintel_csrf';
export const CSRF_HEADER = 'x-lintel-csrf';
