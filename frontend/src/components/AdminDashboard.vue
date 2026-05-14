<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { apiFetch, fetchAdminResource } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import EmptyState from './ui/EmptyState.vue';
import ErrorState from './ui/ErrorState.vue';
import LoadingState from './ui/LoadingState.vue';

type AdminTab = 'users' | 'models' | 'templates' | 'orders' | 'feedbacks' | 'activation-codes';

const store = useWorkspaceStore();
const tab = ref<AdminTab>('users');
const loading = ref(false);
const error = ref('');
const stats = ref<Record<string, number>>({});
const resources = reactive<Record<AdminTab, unknown[]>>({
  users: [],
  models: [],
  templates: [],
  orders: [],
  feedbacks: [],
  'activation-codes': []
});
const codeForm = reactive({ prefix: 'HICAD', count: 5, tier: 'pro' as 'free' | 'pro' | 'team' });

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: 'users', label: '用户' },
  { id: 'models', label: '模型' },
  { id: 'templates', label: '模板' },
  { id: 'orders', label: '订单' },
  { id: 'feedbacks', label: '反馈' },
  { id: 'activation-codes', label: '激活码' }
];

const rows = computed(() => resources[tab.value]);

onMounted(() => {
  void refreshAll();
});

async function refreshAll() {
  if (!store.isAdmin) return;
  loading.value = true;
  error.value = '';
  try {
    stats.value = await fetchAdminResource<Record<string, number>>('stats', store.apiAuth());
    await refreshTab(tab.value);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '管理后台加载失败';
  } finally {
    loading.value = false;
  }
}

async function refreshTab(nextTab = tab.value) {
  tab.value = nextTab;
  if (!store.isAdmin) return;
  const resource = nextTab === 'activation-codes' ? 'activation-codes' : nextTab;
  resources[nextTab] = await fetchAdminResource<unknown[]>(resource, store.apiAuth());
}

async function createCodes() {
  try {
    const result = await apiFetch<{ codes?: string[]; code?: string }>(
      '/admin/activation-codes/batch',
      { method: 'POST', body: JSON.stringify(codeForm) },
      store.apiAuth()
    );
    store.toast('success', `已创建 ${(result.codes ?? [result.code]).filter(Boolean).length} 个激活码`);
    await refreshTab('activation-codes');
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : '创建激活码失败');
  }
}

function rowTitle(row: any): string {
  return row.title ?? row.email ?? row.orderNo ?? row.code ?? row.id ?? '记录';
}

function rowMeta(row: any): string {
  return [row.role, row.tier, row.visibility, row.status, row.category, row.createdAt].filter(Boolean).join(' · ');
}
</script>

<template>
  <section class="view-page admin-dashboard">
    <div class="view-header">
      <div>
        <p class="eyebrow">管理后台</p>
        <h1>运营数据与内容管理</h1>
      </div>
      <button :disabled="loading || !store.isAdmin" aria-label="刷新管理后台数据" @click="refreshAll">刷新</button>
    </div>
    <EmptyState v-if="!store.isAdmin" title="仅管理员可访问后台页面" />
    <template v-else>
      <ErrorState v-if="error" :message="error" />
      <LoadingState v-if="loading" label="正在加载管理后台" compact />
      <div class="stat-grid">
        <div v-for="(value, key) in stats" :key="key" class="stat-cell">
          <span>{{ key }}</span>
          <strong>{{ value }}</strong>
        </div>
      </div>
      <div class="segmented toolbar-row">
        <button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-label="`打开${item.label}管理页`" @click="refreshTab(item.id)">
          {{ item.label }}
        </button>
      </div>
      <form v-if="tab === 'activation-codes'" class="admin-form" @submit.prevent="createCodes">
        <input v-model="codeForm.prefix" aria-label="激活码前缀" />
        <input v-model.number="codeForm.count" type="number" min="1" max="100" aria-label="数量" />
        <select v-model="codeForm.tier" aria-label="用户等级">
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="team">team</option>
        </select>
        <button type="submit" aria-label="批量创建激活码">批量创建</button>
      </form>
      <EmptyState v-if="!loading && rows.length === 0" title="暂无记录" compact />
      <div class="admin-list">
        <article v-for="(row, index) in rows" :key="(row as any).id ?? (row as any).code ?? index" class="admin-row">
          <strong>{{ rowTitle(row) }}</strong>
          <small>{{ rowMeta(row) }}</small>
          <pre>{{ JSON.stringify(row, null, 2) }}</pre>
        </article>
      </div>
    </template>
  </section>
</template>
