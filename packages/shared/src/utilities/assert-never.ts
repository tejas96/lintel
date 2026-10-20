/** Compile-time exhaustiveness check for discriminated unions and enums. */
export function assertNever(value: never, context = 'value'): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
