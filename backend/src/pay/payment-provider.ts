import { createPaymentSignature, verifyPaymentSignature } from '../security/payment-signature.js';

export interface PaymentProvider {
  name: string;
  createPayment(order: { orderNo: string; amount: number }): Promise<{ payUrl: string; provider: string }>;
  verifyCallback(payload: Record<string, unknown>, signature: string | undefined): boolean;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly callbackSecret: string) {}

  async createPayment(order: { orderNo: string }): Promise<{ payUrl: string; provider: string }> {
    return { provider: this.name, payUrl: `/api/pay/code/${order.orderNo}` };
  }

  verifyCallback(payload: Record<string, unknown>, signature: string | undefined): boolean {
    return verifyPaymentSignature(payload, signature, this.callbackSecret);
  }

  signCallback(payload: Record<string, unknown>): string {
    return createPaymentSignature(payload, this.callbackSecret);
  }
}
