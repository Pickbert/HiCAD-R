import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PayController } from '../src/pay/pay.controller.js';
import { createPaymentSignature } from '../src/security/payment-signature.js';
import type { DatabaseState } from '../src/domain.js';

function controller() {
  const state: DatabaseState = {
    schemaVersion: 2,
    users: [],
    activationCodes: [],
    models: [],
    templates: [],
    orders: [
      {
        orderNo: 'ORD-1',
        userId: 'u1',
        plan: 'pro',
        amount: 100,
        status: 'pending',
        provider: 'mock',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }
    ],
    feedbacks: [],
    aiHistory: [],
    shareTokens: [],
    modelLikes: [],
    auditLogs: [],
    quotas: [],
    modelRevisions: []
  };
  return {
    pay: new PayController({ data: state, mutate: async (operation: any) => operation(state) } as any),
    state
  };
}

describe('PayController callback boundaries', () => {
  it('rejects invalid signatures, amount mismatch, and missing orders', async () => {
    process.env.PAY_CALLBACK_SECRET = 'payment-secret-with-at-least-thirty-two-characters';
    const { pay } = controller();
    const body = { orderNo: 'ORD-1', amount: 100, status: 'paid' as const };
    const signature = createPaymentSignature(body, process.env.PAY_CALLBACK_SECRET);

    await expect(Promise.resolve().then(() => pay.callback(body, 'bad'))).rejects.toBeInstanceOf(UnauthorizedException);
    const mismatch = { ...body, amount: 1 };
    await expect(
      Promise.resolve().then(() =>
        pay.callback(mismatch, createPaymentSignature(mismatch, process.env.PAY_CALLBACK_SECRET))
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const missing = { ...body, orderNo: 'missing' };
    await expect(
      Promise.resolve().then(() =>
        pay.callback(missing, createPaymentSignature(missing, process.env.PAY_CALLBACK_SECRET))
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('handles duplicate paid callbacks idempotently', async () => {
    process.env.PAY_CALLBACK_SECRET = 'payment-secret-with-at-least-thirty-two-characters';
    const { pay, state } = controller();
    const body = { orderNo: 'ORD-1', amount: 100, status: 'paid' as const };
    const signature = createPaymentSignature(body, process.env.PAY_CALLBACK_SECRET);

    await pay.callback(body, signature);
    await pay.callback(body, signature);

    expect(state.orders[0].status).toBe('paid');
    expect(state.orders[0].activationCode).toBeTruthy();
  });
});
