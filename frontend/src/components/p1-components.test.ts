import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import AiPanel from './AiPanel.vue';
import MarketPanel from './MarketPanel.vue';
import ParameterPanel from './ParameterPanel.vue';
import { useWorkspaceStore } from '../stores/workspace.js';

const streamGenerate = vi.fn();
const fetchAiHistory = vi.fn();
const fetchMarket = vi.fn();
const fetchTemplates = vi.fn();
const modifyAi = vi.fn();

vi.mock('../api.js', () => ({
  streamGenerate: (...args: unknown[]) => streamGenerate(...args),
  fetchAiHistory: (...args: unknown[]) => fetchAiHistory(...args),
  fetchMarket: (...args: unknown[]) => fetchMarket(...args),
  fetchTemplates: (...args: unknown[]) => fetchTemplates(...args),
  modifyAi: (...args: unknown[]) => modifyAi(...args)
}));

describe('P1 frontend components', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    fetchAiHistory.mockResolvedValue([]);
    fetchMarket.mockResolvedValue([]);
    fetchTemplates.mockResolvedValue([]);
    modifyAi.mockResolvedValue({ code: 'function main(){ return cuboid({ size: [10, 10, 10] }) }' });
  });

  it('AI panel merges stream events and exposes pending code for diff/apply', async () => {
    streamGenerate.mockImplementation((_prompt, _provider, _auth, onEvent: (event: any) => void) => {
      onEvent({ type: 'start', message: 'start' });
      onEvent({ type: 'delta', delta: 'building ' });
      onEvent({ type: 'delta', delta: 'box' });
      onEvent({ type: 'code', code: 'function main(){ return cuboid({ size: [20, 10, 8] }) }' });
      onEvent({ type: 'done', message: 'done' });
      return { close: vi.fn() };
    });
    const store = useWorkspaceStore();
    store.prompt = '生成一个盒子';
    const wrapper = mount(AiPanel);

    await wrapper.get('button[aria-label="提交 AI 建模请求"]').trigger('click');
    await nextTick();

    expect(streamGenerate).toHaveBeenCalledWith('生成一个盒子', store.provider, { accessToken: '' }, expect.any(Function));
    expect(store.pendingAiCode).toContain('cuboid');
    expect(wrapper.text()).toContain('待应用变更');
    expect(store.messages.some((message) => message.text.includes('building box'))).toBe(true);
  });

  it('parameter panel applies numeric parameter changes, reset defaults, and material choice', async () => {
    const store = useWorkspaceStore();
    store.setCode(
      `// @material: cad-blue
const width = 50 // 尺寸/宽度 unit:mm min:10 max:100 step:5
const height = 20 // 尺寸/高度 unit:mm min:10 max:100 step:5`,
      { captureDefaults: true }
    );
    const wrapper = mount(ParameterPanel);

    await wrapper.get('input[type="number"]').setValue('75');
    await wrapper.get('input[type="number"]').trigger('change');
    expect(store.code).toContain('const width = 75');

    await wrapper.get('button[aria-label="重置所有参数为默认值"]').trigger('click');
    expect(store.code).toContain('const width = 50');

    await wrapper.get('button[aria-label="Gold"]').trigger('click');
    expect(store.material).toBe('gold');
    expect(store.code).toContain('@material: gold');
  });

  it('market panel loads templates and market models, filters query, and applies a selected template', async () => {
    fetchTemplates.mockResolvedValue([
      {
        id: 'tpl-1',
        title: 'Starter Box',
        description: 'Box template',
        code: 'function main(){ return cuboid({ size: [10, 10, 10] }) }',
        category: 'fixture',
        tags: ['box'],
        material: 'steel',
        featured: true,
        usageCount: 5,
        sortOrder: 1,
        createdAt: new Date(0).toISOString()
      }
    ]);
    fetchMarket.mockResolvedValue([
      {
        id: 'model-1',
        title: 'Shared Box',
        description: 'Community box',
        code: 'function main(){ return cuboid({ size: [8, 8, 8] }) }',
        category: 'fixture',
        tags: ['shared'],
        material: 'cad-blue',
        visibility: 'public'
      }
    ]);
    const store = useWorkspaceStore();
    const wrapper = mount(MarketPanel);
    await flushPromises();

    expect(wrapper.text()).toContain('Starter Box');
    expect(wrapper.text()).toContain('Shared Box');

    await wrapper.get('input[aria-label="市场搜索"]').setValue('box');
    await wrapper.get('form').trigger('submit.prevent');
    expect(fetchMarket).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'box' }));

    await wrapper.get('button[aria-label="打开模板 Starter Box"]').trigger('click');
    expect(store.title).toBe('Starter Box');
    expect(store.material).toBe('steel');
  });
});

function flushPromises() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
