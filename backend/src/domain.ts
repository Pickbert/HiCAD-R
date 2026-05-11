import type { CadModel, Template, User } from '@hicad/shared';

export interface StoredUser extends User {
  passwordHash: string;
  refreshTokenVersion: number;
}

export interface ActivationCode {
  code: string;
  tier: StoredUser['tier'];
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  usedBy?: string;
  usedAt?: string;
  maxUses: number;
  useCount: number;
  disabled?: boolean;
}

export interface Order {
  orderNo: string;
  userId: string;
  plan: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  provider: 'mock';
  activationCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  userId?: string;
  email?: string;
  content: string;
  status: 'open' | 'reviewing' | 'closed';
  createdAt: string;
  updatedAt?: string;
}

export interface AiHistoryEntry {
  id: string;
  userId?: string;
  provider: string;
  prompt: string;
  code: string;
  createdAt: string;
}

export interface DatabaseState {
  schemaVersion: number;
  users: StoredUser[];
  activationCodes: ActivationCode[];
  models: CadModel[];
  templates: Template[];
  orders: Order[];
  feedbacks: Feedback[];
  aiHistory: AiHistoryEntry[];
  shareTokens: ShareTokenRecord[];
  modelLikes: ModelLike[];
  auditLogs: AuditLog[];
  quotas: UserQuota[];
  modelRevisions?: ModelRevision[];
}

export interface ShareTokenRecord {
  token: string;
  modelId: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  accessCount: number;
  lastAccessedAt?: string;
}

export interface ModelLike {
  modelId: string;
  userId: string;
  createdAt: string;
}

export interface ModelRevision {
  id: string;
  modelId: string;
  title: string;
  description: string;
  code: string;
  createdAt: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface UserQuota {
  userId: string;
  date: string;
  aiCalls: number;
  modelCreates: number;
  exports: number;
}

export function nowIso(): string {
  return new Date().toISOString();
}
