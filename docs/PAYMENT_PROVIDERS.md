# HiCAD 支付 Provider 接入说明

当前 v1 已实现 `PaymentProvider` 抽象和安全 mock provider。真实微信、支付宝或 Stripe 接入前，不应绕过该抽象直接处理回调。

## 已有安全闭环

- 创建订单后记录 `orderNo`、金额、币种、状态和时间。
- 回调必须带签名，签名不通过直接拒绝。
- 回调金额必须等于订单金额。
- 回调订单号必须存在。
- 重复回调保持幂等，已支付订单不重复变更。

## 接入真实平台时必须补齐

- 使用平台官方 SDK 或官方签名算法校验回调。
- 校验商户号、应用号、币种、金额、订单号、支付状态。
- 增加回调重放保护：平台流水号唯一约束、时间戳窗口、nonce 或事件 id 去重。
- 增加订单状态机：`pending -> paid -> refunded/cancelled/failed`，禁止非法状态跳转。
- 对所有支付日志做脱敏：不得输出密钥、完整签名、完整用户 token。
- 为每个平台补集成测试：验签失败、金额不一致、重复回调、订单不存在、状态非法跳转。

## Provider 草图

```ts
export interface PaymentProvider {
  name: string;
  createPayment(order: PaymentOrder): Promise<PaymentCreateResult>;
  verifyCallback(payload: unknown): Promise<VerifiedPaymentCallback>;
}
```

真实 provider 应只返回验签后的标准化结果，由 `PayController` 统一处理订单状态、幂等与审计。
