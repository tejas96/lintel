/** Injection tokens for application ports. Interfaces have no runtime value, so symbols stand in. */
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export const CLOCK = Symbol('CLOCK');
export const SECRET_HASHER = Symbol('SECRET_HASHER');
export const RANDOM_SOURCE = Symbol('RANDOM_SOURCE');
export const OTP_PROVIDER = Symbol('OTP_PROVIDER');
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
export const WORKFLOW_SCHEDULER = Symbol('WORKFLOW_SCHEDULER');
export const FEATURE_FLAGS = Symbol('FEATURE_FLAGS');
