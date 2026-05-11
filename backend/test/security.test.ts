import { describe, expect, it } from 'vitest';
import { assertSecureRuntimeConfig } from '../src/security/runtime-security.js';

describe('assertSecureRuntimeConfig', () => {
  it('rejects placeholder and legacy fallback secrets in production', () => {
    expect(() =>
      assertSecureRuntimeConfig({
        nodeEnv: 'production',
        jwtAccessSecret: 'hicad-access-secret',
        jwtRefreshSecret: 'change-me-to-another-random-string-min-32-chars'
      })
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('accepts long non-placeholder secrets', () => {
    expect(() =>
      assertSecureRuntimeConfig({
        nodeEnv: 'production',
        jwtAccessSecret: 'access-secret-with-at-least-thirty-two-characters',
        jwtRefreshSecret: 'refresh-secret-with-at-least-thirty-two-characters',
        payCallbackSecret: 'payment-secret-with-at-least-thirty-two-characters'
      })
    ).not.toThrow();
  });
});
