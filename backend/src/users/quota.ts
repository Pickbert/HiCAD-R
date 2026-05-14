import { BadRequestException } from '@nestjs/common';
import type { StoredUser, DatabaseState, UserQuota } from '../domain.js';

export type QuotaMetric = 'aiCalls' | 'modelCreates' | 'exports';

export const TIER_QUOTA_LIMITS: Record<StoredUser['tier'], Record<QuotaMetric, number>> = {
  free: { aiCalls: 20, modelCreates: 20, exports: 10 },
  pro: { aiCalls: 300, modelCreates: 500, exports: 200 },
  team: { aiCalls: 2000, modelCreates: 5000, exports: 2000 }
};

export function consumeDailyQuota(
  state: DatabaseState,
  user: StoredUser,
  metric: QuotaMetric,
  now = new Date()
): UserQuota {
  const date = now.toISOString().slice(0, 10);
  const limit = TIER_QUOTA_LIMITS[user.tier][metric];
  let quota = state.quotas.find((entry) => entry.userId === user.id && entry.date === date);
  if (!quota) {
    quota = { userId: user.id, date, aiCalls: 0, modelCreates: 0, exports: 0 };
    state.quotas.push(quota);
  }
  if (quota[metric] >= limit) {
    throw new BadRequestException(`daily ${metric} quota exceeded for ${user.tier} tier`);
  }
  quota[metric] += 1;
  return quota;
}
