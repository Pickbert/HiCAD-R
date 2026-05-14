const sensitiveKeyPattern =
  /(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|jwt|secret|signature|password)/i;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const apiKeyPattern = /\b(?:sk|ds|qwen|deepseek|openai)-[A-Za-z0-9._-]{8,}\b/gi;
const envSecretPattern = /\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|SIGNATURE|JWT)[A-Z0-9_]*=)([^\s"'&,}]+)/gi;

export function redactSensitiveData<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[REDACTED]' : redactValue(entry)
    ])
  );
}

function redactString(value: string): string {
  return value
    .replace(bearerPattern, 'Bearer [REDACTED]')
    .replace(jwtPattern, '[REDACTED]')
    .replace(apiKeyPattern, '[REDACTED]')
    .replace(envSecretPattern, '$1[REDACTED]');
}
