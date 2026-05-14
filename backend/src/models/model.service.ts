import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { CadModel, MaterialPreset } from '@hicad/shared';
import { parseCadParameters } from '@hicad/shared';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { nowIso, StoredUser } from '../domain.js';
import type { SaveModelDto } from './model.dto.js';
import { validateCadCodeSafety } from '../ai/cad-code-safety.js';
import { consumeDailyQuota } from '../users/quota.js';

@Injectable()
export class ModelService {
  constructor(@Inject(JsonDatabaseService) private readonly db: JsonDatabaseService) {}

  listMine(user: StoredUser): CadModel[] {
    return this.db.data.models.filter((model) => model.ownerId === user.id).sort(sortNewest);
  }

  market(query: {
    q?: string;
    category?: string;
    tag?: string;
    tags?: string;
    sort?: string;
    featured?: string;
    source?: string;
  }) {
    const keywords = (query.q ?? '')
      .toLowerCase()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const tags = (query.tags ?? query.tag ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const filtered = this.db.data.models
      .filter((model) => model.visibility === 'public')
      .filter((model) => {
        if (keywords.length === 0) return true;
        const haystack = `${model.title} ${model.description} ${model.tags.join(' ')}`.toLowerCase();
        return keywords.every((keyword) => haystack.includes(keyword));
      })
      .filter((model) => !query.category || model.category === query.category)
      .filter((model) => tags.length === 0 || tags.every((tag) => model.tags.includes(tag)))
      .filter((model) => !query.source || model.source === query.source);
    return filtered.sort(sortMarket(query.sort));
  }

  async create(user: StoredUser, dto: SaveModelDto): Promise<CadModel> {
    const now = nowIso();
    scanModelContent(dto.title, dto.description, dto.tags);
    const model: CadModel = {
      id: uuid(),
      ownerId: user.id,
      title: dto.title?.trim() || '未命名模型',
      description: dto.description?.trim() || '',
      code: rejectDangerousCadCode(dto.code),
      parameters: parseCadParameters(dto.code),
      category: dto.category ?? 'general',
      tags: normalizeTags(dto.tags),
      material: normalizeMaterial(dto.material),
      visibility: 'private',
      likes: 0,
      source: 'manual',
      revisionCount: 1,
      createdAt: now,
      updatedAt: now
    };
    await this.db.mutate((state) => {
      consumeDailyQuota(state, user, 'modelCreates');
      state.models.push(model);
      state.modelRevisions?.push({
        id: uuid(),
        modelId: model.id,
        title: model.title,
        description: model.description,
        code: model.code,
        createdAt: now,
        createdBy: user.id
      });
    });
    return model;
  }

  async update(user: StoredUser, id: string, dto: SaveModelDto): Promise<CadModel> {
    return this.db.mutate((state) => {
      const model = this.findOwned(id, user);
      scanModelContent(dto.title, dto.description, dto.tags);
      model.title = dto.title?.trim() || model.title;
      model.description = dto.description?.trim() ?? model.description;
      model.code = rejectDangerousCadCode(dto.code ?? model.code);
      model.parameters = parseCadParameters(model.code);
      model.category = dto.category ?? model.category;
      model.tags = dto.tags ? normalizeTags(dto.tags) : model.tags;
      model.material = dto.material ? normalizeMaterial(dto.material) : model.material;
      model.updatedAt = nowIso();
      model.revisionCount = (model.revisionCount ?? 0) + 1;
      state.modelRevisions?.push({
        id: uuid(),
        modelId: model.id,
        title: model.title,
        description: model.description,
        code: model.code,
        createdAt: model.updatedAt,
        createdBy: user.id
      });
      return model;
    });
  }

  async remove(user: StoredUser, id: string): Promise<{ deleted: true }> {
    await this.db.mutate((state) => {
      const model = state.models.find((entry) => entry.id === id);
      if (!model) throw new NotFoundException('model not found');
      if (model.ownerId !== user.id && user.role !== 'admin') throw new ForbiddenException('not model owner');
      state.models = state.models.filter((entry) => entry.id !== id);
    });
    return { deleted: true };
  }

  async publish(user: StoredUser, id: string): Promise<CadModel> {
    return this.db.mutate(() => {
      const model = this.findOwned(id, user);
      model.visibility = 'public';
      model.publishedSnapshot = {
        title: model.title,
        description: model.description,
        code: model.code,
        category: model.category,
        tags: model.tags,
        material: model.material,
        publishedAt: nowIso()
      };
      model.updatedAt = nowIso();
      return model;
    });
  }

  async unpublish(user: StoredUser, id: string): Promise<CadModel> {
    return this.db.mutate(() => {
      const model = this.findOwned(id, user);
      model.visibility = 'private';
      model.updatedAt = nowIso();
      return model;
    });
  }

  async like(id: string, user?: StoredUser): Promise<CadModel> {
    return this.db.mutate((state) => {
      const model = state.models.find((entry) => entry.id === id && entry.visibility === 'public');
      if (!model) throw new NotFoundException('public model not found');
      const userId = user?.id ?? 'anonymous';
      if (!state.modelLikes.some((like) => like.modelId === id && like.userId === userId)) {
        state.modelLikes.push({ modelId: id, userId, createdAt: nowIso() });
        model.likes += 1;
      }
      return model;
    });
  }

  async share(user: StoredUser, id: string, ttlSeconds?: number): Promise<{ token: string; url: string }> {
    return this.db.mutate((state) => {
      const model = this.findOwned(id, user);
      model.visibility = model.visibility === 'private' ? 'shared' : model.visibility;
      model.shareToken = model.shareToken ?? uuid().replaceAll('-', '');
      model.updatedAt = nowIso();
      if (!state.shareTokens.some((entry) => entry.token === model.shareToken)) {
        state.shareTokens.push({
          token: model.shareToken,
          modelId: model.id,
          createdAt: nowIso(),
          expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined,
          accessCount: 0
        });
      }
      return { token: model.shareToken, url: `/share/${model.shareToken}` };
    });
  }

  getShare(token: string): CadModel {
    const share = this.db.data.shareTokens.find((entry) => entry.token === token && !entry.revokedAt);
    if (!share || (share.expiresAt && Date.parse(share.expiresAt) < Date.now()))
      throw new NotFoundException('share not found');
    share.accessCount += 1;
    share.lastAccessedAt = nowIso();
    const model = this.db.data.models.find((entry) => entry.id === share.modelId);
    if (!model) throw new NotFoundException('share not found');
    return model;
  }

  get(id: string, user?: StoredUser): CadModel {
    const model = this.db.data.models.find((entry) => entry.id === id);
    if (!model) throw new NotFoundException('model not found');
    if (model.visibility === 'private' && model.ownerId !== user?.id && user?.role !== 'admin') {
      throw new ForbiddenException('not allowed');
    }
    return model;
  }

  async recordExport(
    user: StoredUser,
    id: string,
    format: 'stl' | 'obj'
  ): Promise<{ ok: true; format: 'stl' | 'obj' }> {
    this.get(id, user);
    return this.db.mutate((state) => {
      consumeDailyQuota(state, user, 'exports');
      state.auditLogs.push({
        id: uuid(),
        actorId: user.id,
        action: 'model.export',
        targetType: 'model',
        targetId: id,
        createdAt: nowIso(),
        details: { format }
      });
      return { ok: true, format };
    });
  }

  private findOwned(id: string, user: StoredUser): CadModel {
    const model = this.db.data.models.find((entry) => entry.id === id);
    if (!model) throw new NotFoundException('model not found');
    if (model.ownerId !== user.id && user.role !== 'admin') throw new ForbiddenException('not model owner');
    return model;
  }

  revisions(user: StoredUser, id: string) {
    this.findOwned(id, user);
    return (this.db.data.modelRevisions ?? []).filter((revision) => revision.modelId === id);
  }

  async restoreRevision(user: StoredUser, id: string, revisionId: string): Promise<CadModel> {
    const revision = (this.db.data.modelRevisions ?? []).find(
      (entry) => entry.id === revisionId && entry.modelId === id
    );
    if (!revision) throw new NotFoundException('revision not found');
    return this.update(user, id, {
      title: revision.title,
      description: revision.description,
      code: revision.code
    });
  }

  async importStl(
    user: StoredUser,
    dto: { title: string; filename: string; dataBase64: string; tags?: string[] }
  ): Promise<CadModel> {
    const maxBytes = Number(process.env.UPLOAD_MAX_STL_BYTES ?? 10_485_760);
    if (!/\.stl$/i.test(dto.filename)) throw new BadRequestException('Only .stl files are supported');
    const bytes = Buffer.from(dto.dataBase64, 'base64');
    if (bytes.length > maxBytes) throw new BadRequestException(`STL file exceeds ${maxBytes} bytes`);
    const text = bytes.toString('utf8');
    if (!/^solid\b/i.test(text.trim())) throw new BadRequestException('Only ASCII STL import is supported in v1');
    scanImportedStl(text);
    const metadata = {
      byteLength: bytes.length,
      triangleCount: (text.match(/\bfacet\s+normal\b/gi) ?? []).length,
      importedAt: nowIso()
    };
    const model = await this.create(user, {
      title: dto.title,
      description: `Imported STL: ${dto.filename}`,
      code: `// @material: steel\nconst importedMeshSize = ${bytes.length} // 文件大小 unit:bytes min:1 max:${Math.max(bytes.length, 1)}\nfunction main() { return cuboid({ size: [40, 40, 10] }) }\nmodule.exports = { main }`,
      category: 'imported',
      tags: normalizeTags([...(dto.tags ?? []), 'STL'])
    });
    return this.db.mutate(() => {
      model.source = 'imported';
      model.assetDataBase64 = dto.dataBase64;
      model.assetMimeType = 'model/stl';
      model.assetFilename = dto.filename;
      model.assetMetadata = metadata;
      return model;
    });
  }
}

export function rejectDangerousCadCode(code: string): string {
  try {
    return validateCadCodeSafety(code);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('CAD code is unsafe');
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 12);
}

function normalizeMaterial(material: string | undefined): MaterialPreset {
  const allowed: MaterialPreset[] = [
    'cad-blue',
    'silver',
    'gold',
    'copper',
    'ceramic',
    'glass',
    'neon',
    'matte-black',
    'white',
    'steel'
  ];
  return allowed.includes(material as MaterialPreset) ? (material as MaterialPreset) : 'cad-blue';
}

function scanModelContent(title?: string, description?: string, tags?: string[]) {
  const content = [title, description, ...(tags ?? [])].join('\n');
  if (/<\s*script\b|javascript:|onerror\s*=|onload\s*=/i.test(content)) {
    throw new BadRequestException('Unsafe content is not allowed');
  }
}

function scanImportedStl(text: string) {
  if (/<\s*script\b|<\?php|javascript:|import\s+|fetch\s*\(|websocket/i.test(text)) {
    throw new BadRequestException('Unsafe STL payload is not allowed');
  }
}

function sortNewest(left: CadModel, right: CadModel): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function sortMarket(sort = 'latest') {
  if (sort === 'popular' || sort === 'mostUsed') {
    return (left: CadModel, right: CadModel) => right.likes - left.likes || sortNewest(left, right);
  }
  if (sort === 'featured') {
    return (left: CadModel, right: CadModel) =>
      Number(Boolean(right.publishedSnapshot)) - Number(Boolean(left.publishedSnapshot)) || sortNewest(left, right);
  }
  return sortNewest;
}
