import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { useWorkspaceStore } from './stores/workspace.js';
import type { WorkerMesh } from './utils/mesh.js';

const apiFetch = vi.fn();
const listMine = vi.fn();
const me = vi.fn();
const saveModel = vi.fn();
const updateModel = vi.fn();
const publishModel = vi.fn();
const shareModel = vi.fn();
const recordModelExport = vi.fn();

vi.mock('./api.js', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  fileToBase64Payload: vi.fn(),
  importStl: vi.fn(),
  listMine: (...args: unknown[]) => listMine(...args),
  me: (...args: unknown[]) => me(...args),
  publishModel: (...args: unknown[]) => publishModel(...args),
  recordModelExport: (...args: unknown[]) => recordModelExport(...args),
  saveModel: (...args: unknown[]) => saveModel(...args),
  shareModel: (...args: unknown[]) => shareModel(...args),
  updateModel: (...args: unknown[]) => updateModel(...args)
}));

vi.mock('./components/AiPanel.vue', () => ({ default: { template: '<aside data-testid="ai-panel"></aside>' } }));
vi.mock('./components/CodeEditor.vue', () => ({
  default: { template: '<section data-testid="code-editor"></section>' }
}));
vi.mock('./components/ThreeViewer.vue', () => ({
  default: { template: '<section data-testid="three-viewer"></section>' }
}));
vi.mock('./components/MarketPanel.vue', () => ({
  default: { props: ['embedded'], template: '<section data-testid="market-panel"></section>' }
}));
vi.mock('./components/ParameterPanel.vue', () => ({
  default: { template: '<aside data-testid="parameter-panel"></aside>' }
}));
vi.mock('./components/AdminDashboard.vue', () => ({
  default: { template: '<section data-testid="admin-dashboard"></section>' }
}));
vi.mock('./components/ModelLibrary.vue', () => ({
  default: { template: '<section data-testid="model-library"></section>' }
}));
vi.mock('./components/SharePreview.vue', () => ({
  default: { props: ['token'], template: '<section data-testid="share-preview"></section>' }
}));

describe('App workspace actions', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    vi.clearAllMocks();
    listMine.mockResolvedValue([]);
    me.mockResolvedValue(undefined);
    saveModel.mockResolvedValue({ id: 'model-1', title: 'Saved Box' });
    updateModel.mockResolvedValue({ id: 'model-1', title: 'Updated Box' });
    publishModel.mockResolvedValue({ id: 'model-1', visibility: 'public' });
    shareModel.mockResolvedValue({ token: 'share-token', url: '/share/share-token' });
    recordModelExport.mockResolvedValue({ ok: true, format: 'stl' });
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
    expect(saveModel).toHaveBeenCalledWith(
      expect.objectContaining({ title: store.title, code: store.code }),
      expect.objectContaining({ accessToken: 'access-token' })
    );
    expect(store.currentModelId).toBe('model-1');

    await wrapper.get('button[aria-label="发布当前模型到市场"]').trigger('click');
    await flushPromises();
    expect(publishModel).toHaveBeenCalledWith('model-1', expect.any(Object));

    await wrapper.get('button[aria-label="创建当前模型分享链接"]').trigger('click');
    await flushPromises();
    expect(shareModel).toHaveBeenCalledWith('model-1', expect.any(Object));
    expect(store.toasts.some((toast) => toast.text.includes('share-token'))).toBe(true);
  });

  it('keeps desktop actions visible and routes mobile menu actions through the same handlers', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(App, { global: { plugins: [pinia] } });
    const store = useWorkspaceStore();
    authenticate(store);
    store.currentModelId = 'model-1';
    store.meshes = [triangleMesh()];
    await wrapper.vm.$nextTick();

    const desktopActions = wrapper.get('.desktop-actions');
    expect(desktopActions.find('button[aria-label="保存当前模型"]').exists()).toBe(true);
    expect(desktopActions.find('button[aria-label="发布当前模型到市场"]').exists()).toBe(true);
    expect(desktopActions.find('button[aria-label="预览并导出 STL 文件"]').exists()).toBe(true);
    expect(desktopActions.find('button[aria-label="预览并导出 OBJ 文件"]').exists()).toBe(true);
    expect(desktopActions.find('button[aria-label="创建当前模型分享链接"]').exists()).toBe(true);
    expect(desktopActions.find('button[aria-label="导入 STL 文件"]').exists()).toBe(true);

    await wrapper.get('button[aria-label="打开移动操作菜单"]').trigger('click');
    expect(wrapper.get('.mobile-action-menu').attributes('role')).toBe('menu');

    await wrapper.get('.mobile-action-menu button[aria-label="保存当前模型"]').trigger('click');
    await flushPromises();
    expect(updateModel).toHaveBeenCalledWith('model-1', expect.any(Object), expect.any(Object));

    await wrapper.get('button[aria-label="打开移动操作菜单"]').trigger('click');
    await wrapper.get('.mobile-action-menu button[aria-label="发布当前模型到市场"]').trigger('click');
    await flushPromises();
    expect(publishModel).toHaveBeenCalledWith('model-1', expect.any(Object));

    await wrapper.get('button[aria-label="打开移动操作菜单"]').trigger('click');
    await wrapper.get('.mobile-action-menu button[aria-label="创建当前模型分享链接"]').trigger('click');
    await flushPromises();
    expect(shareModel).toHaveBeenCalledWith('model-1', expect.any(Object));

    await wrapper.get('button[aria-label="打开移动操作菜单"]').trigger('click');
    await wrapper.get('.mobile-action-menu button[aria-label="预览并导出 STL 文件"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('导出预览');
  });

  it('renders internal route views through lazy component boundaries', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(App, { global: { plugins: [pinia] } });
    const store = useWorkspaceStore();

    store.navigate('market');
    await flushPromises();
    expect(wrapper.find('[data-testid="market-panel"]').exists()).toBe(true);

    store.navigate('models');
    await flushPromises();
    expect(wrapper.find('[data-testid="model-library"]').exists()).toBe(true);

    store.navigate('admin');
    await flushPromises();
    expect(wrapper.find('[data-testid="admin-dashboard"]').exists()).toBe(true);
  });
});

function authenticate(store: ReturnType<typeof useWorkspaceStore>) {
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
}

function triangleMesh(): WorkerMesh {
  return {
    material: 'cad-blue',
    color: [0.1, 0.2, 0.3],
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  };
}

function flushPromises() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
