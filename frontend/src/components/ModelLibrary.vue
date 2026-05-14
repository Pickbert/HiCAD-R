<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { CadModel } from '@hicad/shared';
import { listMine, publishModel, shareModel } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import EmptyState from './ui/EmptyState.vue';
import ErrorState from './ui/ErrorState.vue';
import LoadingState from './ui/LoadingState.vue';

const store = useWorkspaceStore();
const filter = ref<'all' | 'draft' | 'published' | 'shared'>('all');
const loading = ref(false);
const error = ref('');

const filteredModels = computed(() => {
  if (filter.value === 'draft') return store.myModels.filter((model) => model.visibility === 'private');
  if (filter.value === 'published') return store.myModels.filter((model) => model.visibility === 'public');
  if (filter.value === 'shared')
    return store.myModels.filter((model) => model.visibility === 'shared' || Boolean(model.shareToken));
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
    await publishModel(model.id, store.apiAuth());
    store.toast('success', '模型已发布');
    await refresh();
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : '发布失败');
  }
}

async function share(model: CadModel) {
  try {
    const shareResult = await shareModel(model.id, store.apiAuth());
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
      <button :disabled="loading || !store.accessToken" aria-label="刷新我的模型列表" @click="refresh">刷新</button>
    </div>
    <EmptyState v-if="!store.accessToken" title="需要登录" detail="登录后可以查看草稿、已发布和分享中的模型" />
    <template v-else>
      <div class="segmented toolbar-row">
        <button :class="{ active: filter === 'all' }" aria-label="显示全部模型" @click="filter = 'all'">全部</button>
        <button :class="{ active: filter === 'draft' }" aria-label="显示草稿模型" @click="filter = 'draft'">
          草稿
        </button>
        <button :class="{ active: filter === 'published' }" aria-label="显示已发布模型" @click="filter = 'published'">
          已发布
        </button>
        <button :class="{ active: filter === 'shared' }" aria-label="显示分享中的模型" @click="filter = 'shared'">
          分享中
        </button>
      </div>
      <ErrorState v-if="error" :message="error" />
      <LoadingState v-if="loading" label="正在加载我的模型" compact />
      <EmptyState v-else-if="filteredModels.length === 0" title="暂无模型" compact />
      <div class="model-grid">
        <article v-for="model in filteredModels" :key="model.id" class="model-card rich">
          <span class="badge">{{
            model.visibility === 'public' ? '已发布' : model.visibility === 'shared' ? '分享中' : '草稿'
          }}</span>
          <strong>{{ model.title }}</strong>
          <small>{{ model.description || '无描述' }}</small>
          <small>{{ model.category }} · {{ model.tags.join(', ') || '无标签' }}</small>
          <div class="card-actions">
            <button :aria-label="`打开模型 ${model.title}`" @click="store.applyModel(model)">打开</button>
            <button
              :disabled="model.visibility === 'public'"
              :aria-label="`发布模型 ${model.title}`"
              @click="publish(model)"
            >
              发布
            </button>
            <button :aria-label="`分享模型 ${model.title}`" @click="share(model)">分享</button>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
