import type { CadModel, Template } from '@hicad/shared';
import type { ActivationCode, AuditLog, Feedback, Order, StoredUser, UserQuota } from '../domain.js';

export interface UserRepository {
  listUsers(): StoredUser[];
  findUserById(id: string): StoredUser | undefined;
  saveUser(user: StoredUser): Promise<StoredUser>;
}

export interface ModelRepository {
  listModels(): CadModel[];
  findModelById(id: string): CadModel | undefined;
  saveModel(model: CadModel): Promise<CadModel>;
}

export interface TemplateRepository {
  listTemplates(): Template[];
  findTemplateById(id: string): Template | undefined;
  saveTemplate(template: Template): Promise<Template>;
}

export interface OrderRepository {
  listOrders(): Order[];
  findOrderByNo(orderNo: string): Order | undefined;
  saveOrder(order: Order): Promise<Order>;
}

export interface FeedbackRepository {
  listFeedbacks(): Feedback[];
  saveFeedback(feedback: Feedback): Promise<Feedback>;
}

export interface ActivationCodeRepository {
  listActivationCodes(): ActivationCode[];
  saveActivationCode(code: ActivationCode): Promise<ActivationCode>;
}

export interface AuditRepository {
  listAuditLogs(): AuditLog[];
  appendAuditLog(log: AuditLog): Promise<AuditLog>;
}

export interface QuotaRepository {
  listQuotas(): UserQuota[];
  saveQuota(quota: UserQuota): Promise<UserQuota>;
}
