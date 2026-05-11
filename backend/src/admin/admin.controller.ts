import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AdminGuard } from '../common/admin.guard.js';
import { JwtGuard } from '../common/jwt.guard.js';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { toPublicUser } from '../auth/auth.service.js';
import { nowIso, StoredUser } from '../domain.js';

@UseGuards(JwtGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly db: JsonDatabaseService) {}

  @Get('stats')
  stats() {
    return {
      users: this.db.data.users.length,
      models: this.db.data.models.length,
      publicModels: this.db.data.models.filter((model) => model.visibility === 'public').length,
      orders: this.db.data.orders.length,
      feedbacks: this.db.data.feedbacks.length
    };
  }

  @Get('users')
  users() {
    return this.db.data.users.map(toPublicUser);
  }

  @Get('orders')
  orders() {
    return this.db.data.orders;
  }

  @Get('models')
  models() {
    return this.db.data.models;
  }

  @Get('templates')
  templates() {
    return this.db.data.templates;
  }

  @Get('feedbacks')
  feedbacks() {
    return this.db.data.feedbacks;
  }

  @Get('activation-codes')
  activationCodes() {
    return this.db.data.activationCodes.map(({ code, tier, createdAt, expiresAt, usedBy, usedAt, maxUses, useCount, disabled }) => ({
      code,
      tier,
      createdAt,
      expiresAt,
      usedBy,
      usedAt,
      maxUses,
      useCount,
      disabled: Boolean(disabled)
    }));
  }

  @Post('activation-codes')
  createActivationCode(@Body() body: { code?: string; tier?: 'free' | 'pro' | 'team'; maxUses?: number; expiresAt?: string; disabled?: boolean }, @CurrentUser() user: StoredUser) {
    const code = body.code?.trim() || crypto.randomUUID().slice(0, 12);
    return this.db.mutate((state) => {
      state.activationCodes.push({
        code,
        tier: body.tier ?? 'pro',
        maxUses: Math.max(1, body.maxUses ?? 1),
        useCount: 0,
        expiresAt: body.expiresAt,
        disabled: Boolean(body.disabled),
        createdBy: user.id,
        createdAt: nowIso()
      });
      return { code };
    });
  }

  @Post('activation-codes/batch')
  createActivationCodes(@Body() body: { prefix?: string; count?: number; tier?: 'free' | 'pro' | 'team'; maxUses?: number; expiresAt?: string; disabled?: boolean }, @CurrentUser() user: StoredUser) {
    const count = Math.min(Math.max(1, body.count ?? 1), 100);
    return this.db.mutate((state) => {
      const codes = Array.from({ length: count }, (_, index) => `${body.prefix ?? 'HICAD'}-${crypto.randomUUID().slice(0, 8)}-${index + 1}`);
      for (const code of codes) {
        state.activationCodes.push({
          code,
          tier: body.tier ?? 'pro',
          maxUses: Math.max(1, body.maxUses ?? 1),
          useCount: 0,
          expiresAt: body.expiresAt,
          disabled: Boolean(body.disabled),
          createdBy: user.id,
          createdAt: nowIso()
        });
      }
      state.auditLogs.push({ id: crypto.randomUUID(), actorId: user.id, action: 'activation_codes.batch_create', targetType: 'activation_code', createdAt: nowIso(), details: { count } });
      return { codes };
    });
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @CurrentUser() user: StoredUser) {
    return this.db.mutate((state) => {
      state.users = state.users.filter((entry) => entry.id !== id || entry.id === user.id);
      return { deleted: true };
    });
  }

  @Post('users/:id/ban')
  banUser(@Param('id') id: string, @CurrentUser() user: StoredUser) {
    return this.db.mutate((state) => {
      const target = state.users.find((entry) => entry.id === id);
      if (target && target.id !== user.id) target.bannedAt = nowIso();
      state.auditLogs.push({ id: crypto.randomUUID(), actorId: user.id, action: 'user.ban', targetType: 'user', targetId: id, createdAt: nowIso() });
      return target ? toPublicUser(target) : { id, bannedAt: undefined };
    });
  }

  @Post('users/:id/unban')
  unbanUser(@Param('id') id: string, @CurrentUser() user: StoredUser) {
    return this.db.mutate((state) => {
      const target = state.users.find((entry) => entry.id === id);
      if (target) delete target.bannedAt;
      state.auditLogs.push({ id: crypto.randomUUID(), actorId: user.id, action: 'user.unban', targetType: 'user', targetId: id, createdAt: nowIso() });
      return target ? toPublicUser(target) : { id };
    });
  }

  @Delete('models/:id')
  deleteModel(@Param('id') id: string) {
    return this.db.mutate((state) => {
      state.models = state.models.filter((entry) => entry.id !== id);
      return { deleted: true };
    });
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.db.mutate((state) => {
      state.templates = state.templates.filter((entry) => entry.id !== id);
      return { deleted: true };
    });
  }

  @Post('templates/:id/feature')
  featureTemplate(@Param('id') id: string, @CurrentUser() user: StoredUser, @Body() body: { sortOrder?: number }) {
    return this.db.mutate((state) => {
      const template = state.templates.find((entry) => entry.id === id);
      if (template) {
        template.featured = true;
        template.sortOrder = body.sortOrder ?? template.sortOrder;
      }
      state.auditLogs.push({ id: crypto.randomUUID(), actorId: user.id, action: 'template.feature', targetType: 'template', targetId: id, createdAt: nowIso() });
      return template;
    });
  }

  @Post('templates/:id/unfeature')
  unfeatureTemplate(@Param('id') id: string, @CurrentUser() user: StoredUser) {
    return this.db.mutate((state) => {
      const template = state.templates.find((entry) => entry.id === id);
      if (template) template.featured = false;
      state.auditLogs.push({ id: crypto.randomUUID(), actorId: user.id, action: 'template.unfeature', targetType: 'template', targetId: id, createdAt: nowIso() });
      return template;
    });
  }

  @Patch('feedbacks/:id')
  updateFeedback(@Param('id') id: string, @CurrentUser() user: StoredUser, @Body() body: { status?: 'open' | 'reviewing' | 'closed' }) {
    return this.db.mutate((state) => {
      const feedback = state.feedbacks.find((entry) => entry.id === id);
      if (feedback && body.status) {
        feedback.status = body.status;
        feedback.updatedAt = nowIso();
      }
      state.auditLogs.push({ id: crypto.randomUUID(), actorId: user.id, action: 'feedback.update', targetType: 'feedback', targetId: id, createdAt: nowIso(), details: { status: body.status } });
      return feedback;
    });
  }

  @Get('diagnostics')
  diagnostics() {
    return {
      ok: true,
      schemaVersion: this.db.data.schemaVersion,
      counts: this.stats(),
      ai: {
        adapter: process.env.AI_ADAPTER ?? 'deepseek',
        deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        qwenConfigured: Boolean(process.env.QWEN_API_KEY),
        deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro',
        openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
        qwenModel: process.env.QWEN_MODEL ?? 'qwen-plus'
      }
    };
  }
}
