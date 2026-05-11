import { describe, expect, it } from 'vitest';
import { ModelService } from '../src/models/model.service.js';
import type { DatabaseState, StoredUser } from '../src/domain.js';

function user(id = 'u1'): StoredUser {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id,
    role: 'user',
    tier: 'pro',
    passwordHash: 'x',
    refreshTokenVersion: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function service() {
  const state: DatabaseState = {
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
  const db = {
    data: state,
    mutate: async (operation: any) => operation(state)
  };
  return { models: new ModelService(db as any), state };
}

describe('ModelService P1 behavior', () => {
  it('keeps draft changes separate from published snapshots and records revisions', async () => {
    const { models } = service();
    const owner = user();
    const model = await models.create(owner, { title: 'Box', code: 'const boxWidth = 10 // 宽度 unit:mm min:1 max:20' });
    await models.publish(owner, model.id);
    await models.update(owner, model.id, { code: 'const boxWidth = 18 // 宽度 unit:mm min:1 max:20' });

    const afterEdit = models.get(model.id, owner);

    expect(afterEdit.code).toContain('18');
    expect(afterEdit.publishedSnapshot?.code).toContain('10');
    expect(models.revisions(owner, model.id)).toHaveLength(2);
  });

  it('tracks share token expiry and unique likes per user', async () => {
    const { models } = service();
    const owner = user();
    const viewer = user('viewer');
    const model = await models.create(owner, { title: 'Box', code: 'const boxWidth = 10 // 宽度 unit:mm min:1 max:20' });
    await models.publish(owner, model.id);
    const share = await models.share(owner, model.id, 60);
    await models.like(model.id, viewer);
    await models.like(model.id, viewer);

    expect(models.getShare(share.token).id).toBe(model.id);
    expect(models.get(model.id, owner).likes).toBe(1);
  });

  it('records exports against the daily quota and audit log', async () => {
    const { models, state } = service();
    const owner = user();
    const model = await models.create(owner, { title: 'Box', code: 'const boxWidth = 10 // 宽度 unit:mm min:1 max:20' });

    await models.recordExport(owner, model.id, 'stl');

    expect(state.quotas.find((quota) => quota.userId === owner.id)?.exports).toBe(1);
    expect(state.auditLogs.some((log) => log.action === 'model.export' && log.targetId === model.id)).toBe(true);
  });

  it('filters market by multiple keywords and stores imported STL metadata', async () => {
    const { models } = service();
    const owner = user();
    const asciiStl = `solid box\nfacet normal 0 0 1\n outer loop\n  vertex 0 0 0\n  vertex 1 0 0\n  vertex 0 1 0\n endloop\nendfacet\nendsolid box\n`;
    const imported = await models.importStl(owner, {
      title: 'Clean Box',
      filename: 'box.stl',
      dataBase64: Buffer.from(asciiStl).toString('base64'),
      tags: ['fixture']
    });
    await models.publish(owner, imported.id);

    const results = models.market({ q: 'clean fixture', sort: 'latest' });

    expect(results.map((model) => model.id)).toContain(imported.id);
    expect(imported.assetMetadata?.triangleCount).toBe(1);
    expect(imported.assetMetadata?.byteLength).toBe(Buffer.byteLength(asciiStl));
  });

  it('rejects unsafe model content and suspicious STL payloads', async () => {
    const { models } = service();
    const owner = user();
    const unsafeStl = Buffer.from('solid x\n<script>alert(1)</script>\nendsolid x').toString('base64');

    await expect(models.create(owner, { title: '<script>x</script>', code: 'const boxWidth = 10 // 宽度 unit:mm min:1 max:20' })).rejects.toThrow(/unsafe content/i);
    await expect(models.importStl(owner, { title: 'Bad STL', filename: 'bad.stl', dataBase64: unsafeStl })).rejects.toThrow(/unsafe stl/i);
  });
});
