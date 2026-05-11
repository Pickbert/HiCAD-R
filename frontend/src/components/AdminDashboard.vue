<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { apiFetch, fetchAdminResource } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';

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
      <button :disabled="loading || !store.isAdmin" @click="refreshAll">刷新</button>
    </div>
    <div v-if="!store.isAdmin" class="empty">仅管理员可访问后台页面</div>
    <template v-else>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="stat-grid">
        <div v-for="(value, key) in stats" :key="key" class="stat-cell">
          <span>{{ key }}</span>
          <strong>{{ value }}</strong>
        </div>
      </div>
      <div class="segmented toolbar-row">
        <button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" @click="refreshTab(item.id)">
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
        <button type="submit">批量创建</button>
      </form>
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
