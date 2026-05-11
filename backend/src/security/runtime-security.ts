export interface RuntimeSecurityConfig {
  nodeEnv?: string;
  jwtAccessSecret?: string;
  jwtRefreshSecret?: string;
  payCallbackSecret?: string;
}

const forbiddenSecretValues = new Set([
  '',
  'hicad-access-secret',
  'hicad-refresh-secret',
  'change-me-to-random-string-32chars',
  'change-me-to-a-random-string-min-32-chars',
  'change-me-to-another-random-string-min-32-chars'
]);

export function assertSecureRuntimeConfig(config: RuntimeSecurityConfig): void {
  const isProduction = config.nodeEnv === 'production';
  assertSecret('JWT_ACCESS_SECRET', config.jwtAccessSecret, isProduction);
  assertSecret('JWT_REFRESH_SECRET', config.jwtRefreshSecret, isProduction);
  if (isProduction) {
    assertSecret('PAY_CALLBACK_SECRET', config.payCallbackSecret, true);
  }
}

export function getRequiredSecret(name: string, value: string | undefined, fallbackForDevelopment: string): string {
  if (value && value.trim().length > 0) {
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured in production`);
  }
  return fallbackForDevelopment;
}

function assertSecret(name: string, value: string | undefined, required: boolean): void {
  const normalized = value?.trim() ?? '';
  if (!required && normalized.length === 0) {
    return;
  }
  if (normalized.length < 32 || forbiddenSecretValues.has(normalized)) {
    throw new Error(`${name} must be a non-placeholder secret with at least 32 characters`);
  }
}
