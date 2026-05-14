import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { useWorkspaceStore } from './stores/workspace.js';

const apiFetch = vi.fn();
const listMine = vi.fn();
const me = vi.fn();

vi.mock('./api.js', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  fileToBase64Payload: vi.fn(),
  importStl: vi.fn(),
  listMine: (...args: unknown[]) => listMine(...args),
  me: (...args: unknown[]) => me(...args)
}));

vi.mock('./components/AiPanel.vue', () => ({ default: { template: '<aside data-testid="ai-panel"></aside>' } }));
vi.mock('./components/CodeEditor.vue', () => ({ default: { template: '<section data-testid="code-editor"></section>' } }));
vi.mock('./components/ThreeViewer.vue', () => ({ default: { template: '<section data-testid="three-viewer"></section>' } }));
vi.mock('./components/MarketPanel.vue', () => ({ default: { props: ['embedded'], template: '<section data-testid="market-panel"></section>' } }));
vi.mock('./components/ParameterPanel.vue', () => ({ default: { template: '<aside data-testid="parameter-panel"></aside>' } }));
vi.mock('./components/AdminDashboard.vue', () => ({ default: { template: '<section data-testid="admin-dashboard"></section>' } }));
vi.mock('./components/ModelLibrary.vue', () => ({ default: { template: '<section data-testid="model-library"></section>' } }));
vi.mock('./components/SharePreview.vue', () => ({ default: { props: ['token'], template: '<section data-testid="share-preview"></section>' } }));

describe('App workspace actions', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    vi.clearAllMocks();
    listMine.mockResolvedValue([]);
    me.mockResolvedValue(undefined);
    apiFetch.mockImplementation((path: string) => {
      if (path === '/models') return Promise.resolve({ id: 'model-1', title: 'Saved Box' });
      if (path === '/models/model-1/publish') return Promise.resolve({ id: 'model-1', visibility: 'public' });
      if (path === '/models/model-1/share') return Promise.resolve({ token: 'share-token' });
      return Promise.resolve({});
    });
  });

  it('saves, publishes, and shares using the authenticated API flow', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(App, { global: { plugins: [pinia] } });
    const store = useWorkspaceStore();
    store.accessToken = 'access-token';
    store.refreshToken = 'refresh-token';
    store.user = {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User',
      role: 'user',
      tier: 'pro',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };

    await wrapper.get('button[aria-label="保存当前模型"]').trigger('click');
    await flushPromises();
    expect(apiFetch).toHaveBeenCalledWith('/models', expect.objectContaining({ method: 'POST' }), expect.objectContaining({ accessToken: 'access-token' }));
    expect(store.currentModelId).toBe('model-1');

    await wrapper.get('button[aria-label="发布当前模型到市场"]').trigger('click');
    await flushPromises();
    expect(apiFetch).toHaveBeenCalledWith('/models/model-1/publish', expect.objectContaining({ method: 'POST' }), expect.any(Object));

    await wrapper.get('button[aria-label="创建当前模型分享链接"]').trigger('click');
    await flushPromises();
    expect(apiFetch).toHaveBeenCalledWith('/models/model-1/share', expect.objectContaining({ method: 'POST' }), expect.any(Object));
    expect(store.toasts.some((toast) => toast.text.includes('share-token'))).toBe(true);
  });
});

function flushPromises() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
