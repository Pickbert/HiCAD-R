<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CadModel, Template } from '@hicad/shared';
import { fetchMarket, fetchTemplates } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';

const store = useWorkspaceStore();
const models = ref<CadModel[]>([]);
const templates = ref<Template[]>([]);
const error = ref('');

onMounted(async () => {
  try {
    const [marketModels, templateList] = await Promise.all([fetchMarket(), fetchTemplates()]);
    models.value = marketModels;
    templates.value = templateList;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  }
});
</script>

<template>
  <aside class="market-panel">
    <div class="section-label">模型市场</div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="cards">
      <button v-for="template in templates" :key="template.id" class="model-card" @click="store.applyTemplate(template)">
        <span class="badge">官方模板</span>
        <strong>{{ template.title }}</strong>
        <small>{{ template.description }}</small>
      </button>
      <button v-for="model in models" :key="model.id" class="model-card" @click="store.applyTemplate(model)">
        <span class="badge">社区共创</span>
        <strong>{{ model.title }}</strong>
        <small>{{ model.description }}</small>
      </button>
    </div>
  </aside>
</template>
