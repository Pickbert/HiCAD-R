import { describe, expect, it } from 'vitest';
import { createPaymentSignature, verifyPaymentSignature } from '../src/security/payment-signature.js';

describe('payment callback signatures', () => {
  it('accepts matching HMAC signatures and rejects tampered callbacks', () => {
    const secret = 'payment-signing-secret-with-enough-entropy';
    const payload = {
      orderNo: 'ORD-1001',
      amount: 1999,
      status: 'paid',
      timestamp: 1715400000
    };
    const signature = createPaymentSignature(payload, secret);

    expect(verifyPaymentSignature(payload, signature, secret)).toBe(true);
    expect(verifyPaymentSignature({ ...payload, amount: 1 }, signature, secret)).toBe(false);
  });
});
