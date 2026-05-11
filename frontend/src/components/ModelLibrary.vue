<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { CadModel } from '@hicad/shared';
import { apiFetch, listMine } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';

const store = useWorkspaceStore();
const filter = ref<'all' | 'draft' | 'published' | 'shared'>('all');
const loading = ref(false);
const error = ref('');

const filteredModels = computed(() => {
  if (filter.value === 'draft') return store.myModels.filter((model) => model.visibility === 'private');
  if (filter.value === 'published') return store.myModels.filter((model) => model.visibility === 'public');
  if (filter.value === 'shared') return store.myModels.filter((model) => model.visibility === 'shared' || Boolean(model.shareToken));
  return store.myModels;
});

onMounted(() => {
  void refresh();
});

async function refresh() {
  if (!store.accessToken) return;
  loading.value = true;
  error.value = '';
  try {
    store.myModels = await listMine(store.apiAuth());
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '模型列表加载失败';
  } finally {
    loading.value = false;
  }
}

async function publish(model: CadModel) {
  try {
    await apiFetch(`/models/${model.id}/publish`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) }, store.apiAuth());
    store.toast('success', '模型已发布');
    await refresh();
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : '发布失败');
  }
}

async function share(model: CadModel) {
  try {
    const shareResult = await apiFetch<{ token: string; url: string }>(`/models/${model.id}/share`, { method: 'POST' }, store.apiAuth());
    store.toast('success', `分享链接 #/share/${shareResult.token}`);
    await refresh();
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : '分享失败');
  }
}
</script>

<template>
  <section class="view-page model-library">
    <div class="view-header">
      <div>
        <p class="eyebrow">模型列表</p>
        <h1>我的模型</h1>
      </div>
      <button :disabled="loading || !store.accessToken" @click="refresh">刷新</button>
    </div>
    <div v-if="!store.accessToken" class="empty">登录后可以查看草稿、已发布和分享中的模型</div>
    <template v-else>
      <div class="segmented toolbar-row">
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button :class="{ active: filter === 'draft' }" @click="filter = 'draft'">草稿</button>
        <button :class="{ active: filter === 'published' }" @click="filter = 'published'">已发布</button>
        <button :class="{ active: filter === 'shared' }" @click="filter = 'shared'">分享中</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="filteredModels.length === 0" class="empty compact">{{ loading ? '加载中' : '暂无模型' }}</div>
      <div class="model-grid">
        <article v-for="model in filteredModels" :key="model.id" class="model-card rich">
          <span class="badge">{{ model.visibility === 'public' ? '已发布' : model.visibility === 'shared' ? '分享中' : '草稿' }}</span>
          <strong>{{ model.title }}</strong>
          <small>{{ model.description || '无描述' }}</small>
          <small>{{ model.category }} · {{ model.tags.join(', ') || '无标签' }}</small>
          <div class="card-actions">
            <button @click="store.applyModel(model)">打开</button>
            <button :disabled="model.visibility === 'public'" @click="publish(model)">发布</button>
            <button @click="share(model)">分享</button>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
