import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignablePaymentPayload = Record<string, unknown>;

export function createPaymentSignature(payload: SignablePaymentPayload, secret: string): string {
  return createHmac('sha256', secret).update(canonicalize(payload)).digest('hex');
}

export function verifyPaymentSignature(payload: SignablePaymentPayload, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }
  const expected = Buffer.from(createPaymentSignature(payload, secret), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'signature')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
