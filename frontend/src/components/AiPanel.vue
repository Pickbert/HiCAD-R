<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { streamGenerate, type ClosableStream } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';

const store = useWorkspaceStore();
const source = ref<ClosableStream | null>(null);

function generate() {
  if (!store.prompt.trim() || store.isGenerating) return;
  store.messages.push({ role: 'user', text: store.prompt });
  store.isGenerating = true;
  source.value?.close();
  source.value = streamGenerate(store.prompt, store.provider, { accessToken: store.accessToken }, (event) => {
    if (event.type === 'delta' && event.delta) {
      store.messages.push({ role: 'assistant', text: event.delta });
    }
    if (event.type === 'code' && event.code) {
      store.setCode(event.code);
    }
    if (event.type === 'done' || event.type === 'error') {
      store.isGenerating = false;
      if (event.message) store.messages.push({ role: event.type === 'error' ? 'system' : 'assistant', text: event.message });
      source.value?.close();
      source.value = null;
    }
  });
}

onBeforeUnmount(() => source.value?.close());
</script>

<template>
  <aside class="ai-panel">
    <div class="panel-title">
      <span class="status-dot"></span>
      <span>AI 建模助手</span>
    </div>
    <select v-model="store.provider" class="control">
      <option value="deepseek">HiCAD 1.0 · DeepSeek</option>
      <option value="openai">GPT-4o · OpenAI</option>
      <option value="qwen">Qwen-Max · 千问</option>
    </select>
    <div class="messages">
      <div v-if="store.messages.length === 0" class="empty">
        用自然语言描述你的参数化 3D 模型
      </div>
      <div v-for="(message, index) in store.messages" :key="index" :class="['message', message.role]">
        {{ message.text }}
      </div>
    </div>
    <div class="prompt-row">
      <textarea
        v-model="store.prompt"
        placeholder="例如：生成一个 50x30x20mm 的长方形盒子"
        @keydown.enter.exact.prevent="generate"
      ></textarea>
      <button :disabled="store.isGenerating" @click="generate">
        {{ store.isGenerating ? '生成中' : '发送' }}
      </button>
    </div>
  </aside>
</template>
