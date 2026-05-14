<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fetchAiHistory, modifyAi, streamGenerate, type ClosableStream } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import { mergeAiStreamEvent, summarizeAiEvent } from '../utils/ai.js';
import EmptyState from './ui/EmptyState.vue';

const store = useWorkspaceStore();
const source = ref<ClosableStream | null>(null);
const lastPrompt = computed(() => [...store.messages].reverse().find((message) => message.role === 'user')?.text ?? store.prompt);

onMounted(() => {
  void loadHistory();
});

function generate() {
  if (!store.prompt.trim() || store.isGenerating) return;
  store.messages.push({ role: 'user', text: store.prompt });
  store.isGenerating = true;
  store.aiStatus = 'start';
  store.aiEvents = [];
  store.discardPendingAiCode();
  source.value?.close();
  source.value = streamGenerate(store.prompt, store.provider, { accessToken: store.accessToken }, (event) => {
    store.aiStatus = event.type;
    store.aiEvents.push(summarizeAiEvent(event));
    store.messages = mergeAiStreamEvent(store.messages, event);
    if (event.type === 'code' && event.code) {
      store.setPendingAiCode(event.code);
    }
    if (event.type === 'done' || event.type === 'error') {
      store.isGenerating = false;
      source.value?.close();
      source.value = null;
      void loadHistory();
    }
  });
}

async function modifyCurrentCode() {
  if (!store.prompt.trim() || store.isGenerating) return;
  store.messages.push({ role: 'user', text: `基于当前代码修改：${store.prompt}` });
  store.isGenerating = true;
  store.aiStatus = 'start';
  store.aiEvents = ['开始基于当前代码修改'];
  store.discardPendingAiCode();
  try {
    const result = await modifyAi(store.prompt, store.code, store.apiAuth());
    store.setPendingAiCode(result.code);
    store.aiStatus = 'code';
    store.messages.push({ role: 'assistant', text: '修改草案已生成，请查看差异后应用。' });
    await loadHistory();
  } catch (caught) {
    store.aiStatus = 'error';
    store.messages.push({ role: 'system', text: caught instanceof Error ? caught.message : 'AI 修改失败' });
  } finally {
    store.isGenerating = false;
  }
}

function submit() {
  if (store.aiMode === 'modify') void modifyCurrentCode();
  else generate();
}

function regenerate() {
  if (!lastPrompt.value) return;
  store.prompt = lastPrompt.value.replace(/^基于当前代码修改：/, '');
  submit();
}

async function loadHistory() {
  if (!store.accessToken) {
    store.aiHistory = [];
    return;
  }
  try {
    store.aiHistory = await fetchAiHistory(store.apiAuth());
  } catch {
    store.aiHistory = [];
  }
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
    <div class="segmented">
      <button :class="{ active: store.aiMode === 'generate' }" aria-label="切换到 AI 生成模式" @click="store.aiMode = 'generate'">生成</button>
      <button :class="{ active: store.aiMode === 'modify' }" aria-label="切换到基于当前代码修改模式" @click="store.aiMode = 'modify'">修改当前代码</button>
    </div>
    <div class="status-track">
      <span v-for="state in ['start', 'spec', 'retry', 'code', 'done', 'error']" :key="state" :class="{ active: store.aiStatus === state }">
        {{ state }}
      </span>
    </div>
    <div class="messages">
      <EmptyState v-if="store.messages.length === 0" title="用自然语言描述你的参数化 3D 模型" />
      <div v-for="(message, index) in store.messages" :key="index" :class="['message', message.role]">
        {{ message.text }}
      </div>
    </div>
    <section v-if="store.pendingAiCode" class="diff-panel">
      <div class="section-label">待应用变更</div>
      <p>
        +{{ store.pendingAiSummary?.added ?? 0 }} / -{{ store.pendingAiSummary?.removed ?? 0 }} ·
        {{ store.pendingAiSummary?.changed ?? 0 }} 处核心变化
      </p>
      <pre>{{ store.pendingAiSummary?.preview.join('\n') }}</pre>
      <div class="card-actions">
        <button aria-label="应用 AI 生成代码" @click="store.applyPendingAiCode">应用</button>
        <button aria-label="丢弃 AI 生成代码" @click="store.discardPendingAiCode">丢弃</button>
      </div>
    </section>
    <details class="history-box">
      <summary>历史记录 {{ store.aiHistory.length }}</summary>
      <button v-for="entry in store.aiHistory.slice(0, 6)" :key="entry.id" class="history-item" :aria-label="`预览历史生成 ${entry.prompt}`" @click="store.setPendingAiCode(entry.code)">
        <strong>{{ entry.prompt }}</strong>
        <small>{{ entry.provider }} · {{ new Date(entry.createdAt).toLocaleString() }}</small>
      </button>
    </details>
    <div class="prompt-row">
      <textarea
        v-model="store.prompt"
        placeholder="例如：生成一个 50x30x20mm 的长方形盒子"
        @keydown.enter.exact.prevent="submit"
      ></textarea>
      <button :disabled="store.isGenerating" aria-label="提交 AI 建模请求" @click="submit">
        {{ store.isGenerating ? '处理中' : store.aiMode === 'modify' ? '修改' : '发送' }}
      </button>
    </div>
    <button :disabled="store.isGenerating || !lastPrompt" aria-label="根据上次提示重新生成" @click="regenerate">重新生成</button>
  </aside>
</template>
