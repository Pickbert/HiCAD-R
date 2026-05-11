import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonDatabaseService } from '../src/database/json-database.service.js';

class TestConfig {
  constructor(private readonly values: Record<string, string>) {}
  get(key: string) {
    return this.values[key];
  }
}

describe('JsonDatabaseService', () => {
  it('serializes concurrent mutations through a write queue', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hicad-db-'));
    const db = new JsonDatabaseService(new TestConfig({ DATA_DIR: dir, NODE_ENV: 'test' }) as any);
    await db.onModuleInit();

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        db.mutate(async (state) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          state.feedbacks.push({ id: String(index), content: `f${index}`, createdAt: new Date(0).toISOString(), status: 'open' } as any);
        })
      )
    );

    expect(db.data.feedbacks).toHaveLength(8);
  });

  it('migrates legacy data and template fields into the current schema', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hicad-db-'));
    await writeFile(join(dir, 'hicad-db.json'), JSON.stringify({ users: [], models: [] }), 'utf8');
    await writeFile(
      join(dir, 'templates.json'),
      JSON.stringify({ templates: [{ id: 'tpl-1', name: '旧模板', tier: 'free', code: 'const x = 1' }] }),
      'utf8'
    );
    const db = new JsonDatabaseService(new TestConfig({ DATA_DIR: dir, NODE_ENV: 'test' }) as any);

    await db.onModuleInit();

    expect(db.data.schemaVersion).toBe(2);
    expect(db.data.templates[0]).toMatchObject({ id: 'tpl-1', title: '旧模板', featured: true, usageCount: 0 });
    expect(db.data.auditLogs).toEqual([]);
  });
});
