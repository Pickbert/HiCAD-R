const secretPatterns = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /("api[_-]?key"\s*:\s*")[^"]+(")/gi,
  /(api[_-]?key=)[^&\s]+/gi
];

export function redactSecrets(input: string): string {
  return secretPatterns.reduce(
    (text, pattern) => text.replace(pattern, (_match, prefix = '', suffix = '') => `${prefix}[REDACTED]${suffix}`),
    input
  );
}
