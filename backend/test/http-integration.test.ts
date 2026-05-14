import { afterEach, describe, expect, it } from 'vitest';
import type { Template } from '@hicad/shared';
import { bearer, collectSse, createHttpTestApp, parseSseEvents, registerUser, type HttpTestApp } from './http-test-app.js';

const template: Template = {
  id: 'tpl-box',
  title: 'Template Box',
  description: 'Reusable box template',
  code: 'const boxWidth = 80 // 宽度 unit:mm min:10 max:200\nfunction main(){ return cuboid({ size: [boxWidth, 40, 20] }) }',
  category: 'fixtures',
  tags: ['box', 'starter'],
  material: 'gold',
  featured: true,
  usageCount: 0,
  sortOrder: 10,
  createdAt: new Date(0).toISOString()
};

describe('HiCAD HTTP integration', () => {
  let http: HttpTestApp | undefined;

  afterEach(async () => {
    await http?.close();
    http = undefined;
  });

  it('covers registration, login, refresh token, and /users/me', async () => {
    http = await createHttpTestApp();

    const registered = await registerUser(http, uniqueEmail('auth'));
    expect(registered.user.role).toBe('admin');
    expect(registered.accessToken).toBeTruthy();
    expect(registered.refreshToken).toBeTruthy();

    const login = await http.request.post('/api/auth/login').send({ email: registered.user.email, password: 'password123' }).expect(201);
    expect(login.body.user.email).toBe(registered.user.email);

    const refresh = await http.request.post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(201);
    expect(refresh.body.accessToken).toBeTruthy();

    const me = await http.request.get('/api/users/me').set('Authorization', bearer(refresh.body.accessToken)).expect(200);
    expect(me.body.email).toBe(registered.user.email);
  });

  it('covers model CRUD, publish, unpublish, share, and public share preview', async () => {
    http = await createHttpTestApp();
    const auth = await registerUser(http, uniqueEmail('models'));

    const created = await http.request
      .post('/api/models')
      .set('Authorization', bearer(auth.accessToken))
      .send({ title: 'HTTP Box', description: 'draft', code: 'const boxWidth = 80 // 宽度 unit:mm min:10 max:200', category: 'workspace', tags: ['http'], material: 'cad-blue' })
      .expect(201);
    expect(created.body.visibility).toBe('private');

    const updated = await http.request
      .put(`/api/models/${created.body.id}`)
      .set('Authorization', bearer(auth.accessToken))
      .send({ title: 'Updated HTTP Box', description: 'updated', code: 'const boxWidth = 120 // 宽度 unit:mm min:10 max:200', category: 'workspace', tags: ['http'], material: 'steel' })
      .expect(200);
    expect(updated.body.title).toBe('Updated HTTP Box');

    const published = await http.request.post(`/api/models/${created.body.id}/publish`).set('Authorization', bearer(auth.accessToken)).send({ visibility: 'public' }).expect(201);
    expect(published.body.visibility).toBe('public');

    const market = await http.request.get('/api/models/market?q=updated').expect(200);
    expect(market.body.map((model: any) => model.id)).toContain(created.body.id);

    const share = await http.request.post(`/api/models/${created.body.id}/share`).set('Authorization', bearer(auth.accessToken)).expect(201);
    expect(share.body.token).toBeTruthy();
    await http.request.get(`/api/models/share/${share.body.token}`).expect(200).expect((res) => {
      expect(res.body.id).toBe(created.body.id);
    });

    const unpublished = await http.request.post(`/api/models/${created.body.id}/unpublish`).set('Authorization', bearer(auth.accessToken)).expect(201);
    expect(unpublished.body.visibility).toBe('private');

    await http.request.delete(`/api/models/${created.body.id}`).set('Authorization', bearer(auth.accessToken)).expect(200);
    await http.request.get(`/api/models/${created.body.id}`).set('Authorization', bearer(auth.accessToken)).expect(404);
  });

  it('covers template listing, reading, and use payload', async () => {
    http = await createHttpTestApp([template]);

    const list = await http.request.get('/api/templates').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(template.id);

    const read = await http.request.get(`/api/templates/${template.id}`).expect(200);
    expect(read.body.title).toBe(template.title);

    const used = await http.request.post(`/api/templates/${template.id}/use`).expect(201);
    expect(used.body).toMatchObject({ title: read.body.title, code: read.body.code, material: read.body.material });
  });

  it('covers AI SSE fallback event sequence', async () => {
    http = await createHttpTestApp();

    const response = await http.request.get('/api/ai/generate?prompt=make%20a%20box&provider=deepseek').buffer(true).parse(collectSse).expect(200);
    const events = parseSseEvents(response.body);

    expect(events.map((event) => event.type)).toEqual(['start', 'error', 'fallback', 'spec', 'code', 'done']);
    expect(events.find((event) => event.type === 'code')?.code).toContain('function main()');
  });

  it('covers admin permission boundaries and activation code management', async () => {
    http = await createHttpTestApp();
    const admin = await registerUser(http, uniqueEmail('admin'));
    const user = await registerUser(http, uniqueEmail('user'));

    await http.request.get('/api/admin/stats').expect(401);
    await http.request.get('/api/admin/stats').set('Authorization', bearer(user.accessToken)).expect(403);
    const stats = await http.request.get('/api/admin/stats').set('Authorization', bearer(admin.accessToken)).expect(200);
    expect(stats.body.users).toBe(2);

    const created = await http.request.post('/api/admin/activation-codes').set('Authorization', bearer(admin.accessToken)).send({ code: 'HTTP-CODE', tier: 'team', maxUses: 2 }).expect(201);
    expect(created.body.code).toBe('HTTP-CODE');
  });

  it('rejects forged payment callbacks through the HTTP API', async () => {
    http = await createHttpTestApp();
    const auth = await registerUser(http, uniqueEmail('pay'));
    const order = await http.request.post('/api/pay/create').set('Authorization', bearer(auth.accessToken)).send({ plan: 'pro', amount: 100 }).expect(201);

    await http.request.post('/api/pay/callback').set('x-hicad-signature', 'forged').send({ orderNo: order.body.orderNo, amount: 100, status: 'paid' }).expect(401);
  });
});

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}
