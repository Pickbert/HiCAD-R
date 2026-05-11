<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { fetchShare } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import ThreeViewer from './ThreeViewer.vue';

const props = defineProps<{ token: string }>();
const store = useWorkspaceStore();

onMounted(() => {
  void loadShare();
});

watch(
  () => props.token,
  () => loadShare()
);

async function loadShare() {
  if (!props.token) return;
  try {
    const model = await fetchShare(props.token, store.apiAuth());
    store.title = model.title;
    store.setCode(model.code, { captureDefaults: true });
    store.material = model.material;
    store.currentModelId = model.id;
    store.toast('success', '分享模型已加载');
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : '分享链接不可用');
  }
}
</script>

<template>
  <section class="share-preview">
    <div class="view-header">
      <div>
        <p class="eyebrow">只读分享预览</p>
        <h1>{{ store.title }}</h1>
      </div>
      <button @click="store.navigate('workspace')">回到工作台</button>
    </div>
    <div class="share-layout">
      <ThreeViewer />
      <pre class="readonly-code">{{ store.code }}</pre>
    </div>
  </section>
</template>
