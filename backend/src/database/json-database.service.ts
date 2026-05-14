import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CadModel, Template } from '@hicad/shared';
import type { ActivationCode, AuditLog, DatabaseState, Feedback, Order, StoredUser, UserQuota } from '../domain.js';
import { nowIso } from '../domain.js';
import type {
  ActivationCodeRepository,
  AuditRepository,
  FeedbackRepository,
  ModelRepository,
  OrderRepository,
  QuotaRepository,
  TemplateRepository,
  UserRepository
} from './repository.js';

@Injectable()
export class JsonDatabaseService
  implements
    OnModuleInit,
    UserRepository,
    ModelRepository,
    TemplateRepository,
    OrderRepository,
    FeedbackRepository,
    ActivationCodeRepository,
    AuditRepository,
    QuotaRepository
{
  private state: DatabaseState | undefined;
  private writeQueue: Promise<unknown> = Promise.resolve();
  private readonly dataFile: string;
  private readonly templateFile: string;

  constructor(@Optional() @Inject(ConfigService) private readonly config?: ConfigService) {
    const dataDir = this.config?.get<string>('DATA_DIR') ?? process.env.DATA_DIR ?? '../data';
    this.dataFile = resolve(dataDir, 'hicad-db.json');
    this.templateFile = resolve(dataDir, 'templates.json');
  }

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  get data(): DatabaseState {
    if (!this.state) {
      throw new Error('database has not been initialized');
    }
    return this.state;
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.dataFile), { recursive: true });
    await writeFile(this.dataFile, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
  }

  async mutate<T>(operation: (state: DatabaseState) => T | Promise<T>): Promise<T> {
    const run = this.writeQueue.then(async () => {
      const result = await operation(this.data);
      await this.save();
      return result;
    });
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  listUsers(): StoredUser[] {
    return this.data.users;
  }

  findUserById(id: string): StoredUser | undefined {
    return this.data.users.find((user) => user.id === id);
  }

  saveUser(user: StoredUser): Promise<StoredUser> {
    return this.upsert('users', user, (entry) => entry.id === user.id);
  }

  listModels(): CadModel[] {
    return this.data.models;
  }

  findModelById(id: string): CadModel | undefined {
    return this.data.models.find((model) => model.id === id);
  }

  saveModel(model: CadModel): Promise<CadModel> {
    return this.upsert('models', model, (entry) => entry.id === model.id);
  }

  listTemplates(): Template[] {
    return this.data.templates;
  }

  findTemplateById(id: string): Template | undefined {
    return this.data.templates.find((template) => template.id === id);
  }

  saveTemplate(template: Template): Promise<Template> {
    return this.upsert('templates', template, (entry) => entry.id === template.id);
  }

  listOrders(): Order[] {
    return this.data.orders;
  }

  findOrderByNo(orderNo: string): Order | undefined {
    return this.data.orders.find((order) => order.orderNo === orderNo);
  }

  saveOrder(order: Order): Promise<Order> {
    return this.upsert('orders', order, (entry) => entry.orderNo === order.orderNo);
  }

  listFeedbacks(): Feedback[] {
    return this.data.feedbacks;
  }

  saveFeedback(feedback: Feedback): Promise<Feedback> {
    return this.upsert('feedbacks', feedback, (entry) => entry.id === feedback.id);
  }

  listActivationCodes(): ActivationCode[] {
    return this.data.activationCodes;
  }

  saveActivationCode(code: ActivationCode): Promise<ActivationCode> {
    return this.upsert('activationCodes', code, (entry) => entry.code === code.code);
  }

  listAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  appendAuditLog(log: AuditLog): Promise<AuditLog> {
    return this.dbAppend('auditLogs', log);
  }

  listQuotas(): UserQuota[] {
    return this.data.quotas;
  }

  saveQuota(quota: UserQuota): Promise<UserQuota> {
    return this.upsert('quotas', quota, (entry) => entry.userId === quota.userId && entry.date === quota.date);
  }

  private upsert<T>(key: keyof DatabaseState, value: T, matches: (entry: T) => boolean): Promise<T> {
    return this.mutate((state) => {
      const collection = (state as unknown as Record<string, unknown>)[key as string] as T[];
      const index = collection.findIndex(matches);
      if (index >= 0) collection[index] = value;
      else collection.push(value);
      return value;
    });
  }

  private dbAppend<T>(key: keyof DatabaseState, value: T): Promise<T> {
    return this.mutate((state) => {
      ((state as unknown as Record<string, unknown>)[key as string] as T[]).push(value);
      return value;
    });
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.dataFile, 'utf8');
      this.state = await this.migrate(JSON.parse(raw) as Partial<DatabaseState>);
      await this.save();
    } catch {
      this.state = {
        schemaVersion: 2,
        users: [],
        activationCodes: this.seedActivationCodes(),
        models: [],
        templates: await this.loadTemplates(),
        orders: [],
        feedbacks: [],
        aiHistory: [],
        shareTokens: [],
        modelLikes: [],
        auditLogs: [],
        quotas: [],
        modelRevisions: []
      };
      await this.save();
    }
  }

  private async migrate(input: Partial<DatabaseState>): Promise<DatabaseState> {
    const migrated: DatabaseState = {
      schemaVersion: 2,
      users: input.users ?? [],
      activationCodes: input.activationCodes ?? this.seedActivationCodes(),
      models: (input.models ?? []).map((model) => ({
        ...model,
        source: model.source ?? 'manual',
        revisionCount: model.revisionCount ?? 0
      })),
      templates: input.templates?.length
        ? input.templates.map((template) => this.normalizeTemplate(template as any))
        : await this.loadTemplates(),
      orders: input.orders ?? [],
      feedbacks: (input.feedbacks ?? []).map((feedback) => ({
        ...feedback,
        status: feedback.status ?? 'open'
      })),
      aiHistory: input.aiHistory ?? [],
      shareTokens: input.shareTokens ?? [],
      modelLikes: input.modelLikes ?? [],
      auditLogs: input.auditLogs ?? [],
      quotas: input.quotas ?? [],
      modelRevisions: input.modelRevisions ?? []
    };
    return migrated;
  }

  private seedActivationCodes(): ActivationCode[] {
    if ((this.config?.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production') {
      return [];
    }
    return [
      {
        code: this.config?.get<string>('DEV_ACTIVATION_CODE') ?? process.env.DEV_ACTIVATION_CODE ?? 'local-dev-code',
        tier: 'pro',
        createdBy: 'system',
        createdAt: nowIso(),
        maxUses: 100,
        useCount: 0
      }
    ];
  }

  private async loadTemplates(): Promise<Template[]> {
    try {
      const raw = await readFile(this.templateFile, 'utf8');
      const parsed = JSON.parse(raw) as { templates?: Array<Record<string, unknown>> };
      return (parsed.templates ?? []).map((template) => this.normalizeTemplate(template));
    } catch {
      return [];
    }
  }

  private normalizeTemplate(template: Record<string, unknown>): Template {
    return {
      id: String(template.id),
      title: String(template.title ?? template.name ?? '未命名模板'),
      description: String(template.description ?? ''),
      code: String(template.code ?? ''),
      category: String(template.category ?? 'general'),
      tags: Array.isArray(template.tags) ? template.tags.map(String) : [],
      material: 'cad-blue',
      featured: Boolean(template.featured ?? template.tier === 'free'),
      usageCount: Number(template.usageCount ?? 0),
      sortOrder: Number(template.sortOrder ?? 0),
      createdAt: String(template.createdAt ?? nowIso())
    };
  }
}
