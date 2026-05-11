import { describe, expect, it } from 'vitest';
import type { DatabaseState, StoredUser } from '../src/domain.js';
import { consumeDailyQuota, TIER_QUOTA_LIMITS } from '../src/users/quota.js';

function state(): DatabaseState {
  return {
    schemaVersion: 2,
    users: [],
    activationCodes: [],
    models: [],
    templates: [],
    orders: [],
    feedbacks: [],
    aiHistory: [],
    shareTokens: [],
    modelLikes: [],
    auditLogs: [],
    quotas: [],
    modelRevisions: []
  };
}

function user(tier: StoredUser['tier']): StoredUser {
  return {
    id: `u-${tier}`,
    email: `${tier}@example.com`,
    displayName: tier,
    role: 'user',
    tier,
    passwordHash: 'x',
    refreshTokenVersion: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

describe('daily tier quotas', () => {
  it('increments the requested metric and rejects over-limit usage', () => {
    const db = state();
    const freeUser = user('free');
    const fixedDate = new Date('2026-05-11T12:00:00.000Z');

    for (let index = 0; index < TIER_QUOTA_LIMITS.free.exports; index += 1) {
      consumeDailyQuota(db, freeUser, 'exports', fixedDate);
    }

    expect(db.quotas[0].exports).toBe(TIER_QUOTA_LIMITS.free.exports);
    expect(() => consumeDailyQuota(db, freeUser, 'exports', fixedDate)).toThrow(/quota exceeded/i);
  });
});
