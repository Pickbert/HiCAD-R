<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { CadModel, Template } from '@hicad/shared';
import { fetchMarket, fetchTemplates } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import EmptyState from './ui/EmptyState.vue';
import ErrorState from './ui/ErrorState.vue';
import LoadingState from './ui/LoadingState.vue';

defineProps<{ embedded?: boolean }>();
const store = useWorkspaceStore();
const models = ref<CadModel[]>([]);
const templates = ref<Template[]>([]);
const error = ref('');
const loading = ref(false);
const query = reactive({
  q: '',
  category: '',
  tag: '',
  sort: 'latest' as 'latest' | 'popular' | 'mostUsed' | 'featured'
});

const categories = computed(() => [
  ...new Set(
    [...templates.value.map((item) => item.category), ...models.value.map((item) => item.category)].filter(Boolean)
  )
]);
const tags = computed(() =>
  [
    ...new Set(
      [...templates.value.flatMap((item) => item.tags), ...models.value.flatMap((item) => item.tags)].filter(Boolean)
    )
  ].slice(0, 18)
);
const filteredTemplates = computed(() =>
  templates.value
    .filter((template) => !query.category || template.category === query.category)
    .filter((template) => !query.tag || template.tags.includes(query.tag))
    .filter((template) => {
      const keywords = query.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (keywords.length === 0) return true;
      const haystack = `${template.title} ${template.description} ${template.tags.join(' ')}`.toLowerCase();
      return keywords.every((keyword) => haystack.includes(keyword));
    })
    .sort((left, right) => {
      if (query.sort === 'featured')
        return Number(right.featured) - Number(left.featured) || right.sortOrder - left.sortOrder;
      if (query.sort === 'mostUsed' || query.sort === 'popular') return right.usageCount - left.usageCount;
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })
);
const resultCount = computed(() => filteredTemplates.value.length + models.value.length);

onMounted(async () => {
  await refresh();
});

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    const [marketModels, templateList] = await Promise.all([fetchMarket(query), fetchTemplates()]);
    models.value = marketModels;
    templates.value = templateList;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section :class="embedded ? 'market-panel' : 'view-page market-page'">
    <div class="view-header" v-if="!embedded">
      <div>
        <p class="eyebrow">模型市场</p>
        <h1>搜索、筛选和复用参数化模型</h1>
      </div>
      <button :disabled="loading" aria-label="刷新模型市场" @click="refresh">刷新</button>
    </div>
    <div class="section-label" v-else>模型市场</div>
    <form class="market-filters" @submit.prevent="refresh">
      <input v-model.trim="query.q" placeholder="搜索模型、标签、描述" aria-label="市场搜索" />
      <select v-model="query.category" aria-label="分类筛选">
        <option value="">全部分类</option>
        <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
      </select>
      <select v-model="query.tag" aria-label="标签筛选">
        <option value="">全部标签</option>
        <option v-for="tag in tags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
      <select v-model="query.sort" aria-label="排序">
        <option value="latest">最新</option>
        <option value="popular">热门</option>
        <option value="mostUsed">最多使用</option>
        <option value="featured">精选</option>
      </select>
      <button :disabled="loading" type="submit" aria-label="搜索模型市场">搜索</button>
    </form>
    <ErrorState v-if="error" :message="error" />
    <LoadingState v-if="loading" label="正在加载市场模型" compact />
    <EmptyState v-else-if="!error && resultCount === 0" title="暂无模型" detail="试试调整搜索词、分类或标签" compact />
    <div class="model-grid">
      <button
        v-for="template in filteredTemplates"
        :key="template.id"
        class="model-card"
        :aria-label="`打开模板 ${template.title}`"
        @click="store.applyTemplate(template)"
      >
        <span class="badge">官方模板</span>
        <strong>{{ template.title }}</strong>
        <small>{{ template.description }}</small>
        <small>{{ template.category }} · {{ template.tags.join(', ') }}</small>
      </button>
      <button
        v-for="model in models"
        :key="model.id"
        class="model-card"
        :aria-label="`打开市场模型 ${model.title}`"
        @click="store.applyTemplate(model)"
      >
        <span class="badge">社区共创</span>
        <strong>{{ model.title }}</strong>
        <small>{{ model.description }}</small>
        <small>{{ model.category }} · {{ model.tags.join(', ') }}</small>
      </button>
    </div>
  </section>
</template>
