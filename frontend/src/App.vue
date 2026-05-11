<script setup lang="ts">
import { computed, ref } from 'vue';
import AiPanel from './components/AiPanel.vue';
import CodeEditor from './components/CodeEditor.vue';
import MarketPanel from './components/MarketPanel.vue';
import ParameterPanel from './components/ParameterPanel.vue';
import ThreeViewer from './components/ThreeViewer.vue';
import { apiFetch } from './api.js';
import { useWorkspaceStore } from './stores/workspace.js';
import { meshToObj, meshToStl } from './utils/mesh.js';

const store = useWorkspaceStore();
const rightPanel = ref<'params' | 'market'>('params');
const authEmail = ref('demo@hicad.local');
const authPassword = ref('password123');
const activationCode = ref('local-dev-code');
const status = ref('');

const auth = computed(() => ({ accessToken: store.accessToken, refreshToken: store.refreshToken }));

async function registerOrLogin(mode: 'register' | 'login') {
  const path = mode === 'register' ? '/auth/register' : '/auth/login';
  const body =
    mode === 'register'
      ? { email: authEmail.value, password: authPassword.value, activationCode: activationCode.value }
      : { email: authEmail.value, password: authPassword.value };
  const result = await apiFetch<any>(path, { method: 'POST', body: JSON.stringify(body) });
  store.accessToken = result.accessToken;
  store.refreshToken = result.refreshToken;
  store.user = result.user;
  status.value = `${result.user.displayName} 已登录`;
}

async function saveModel() {
  const model = await apiFetch<any>(
    store.currentModelId ? `/models/${store.currentModelId}` : '/models',
    {
      method: store.currentModelId ? 'PUT' : 'POST',
      body: JSON.stringify({
        title: store.title,
        description: 'HiCAD 工作台保存的参数化模型',
        code: store.code,
        material: store.material,
        tags: ['HiCAD']
      })
    },
    auth.value
  );
  store.currentModelId = model.id;
  status.value = '模型已保存';
}

async function publishModel() {
  if (!store.currentModelId) await saveModel();
  await apiFetch(`/models/${store.currentModelId}/publish`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) }, auth.value);
  status.value = '模型已发布到市场';
}

async function shareModel() {
  if (!store.currentModelId) await saveModel();
  const share = await apiFetch<any>(`/models/${store.currentModelId}/share`, { method: 'POST' }, auth.value);
  status.value = `分享链接：${share.url}`;
}

async function recordExport(format: 'stl' | 'obj') {
  if (store.currentModelId && store.accessToken) {
    await apiFetch(`/models/${store.currentModelId}/export`, { method: 'POST', body: JSON.stringify({ format }) }, auth.value);
  }
}

async function exportStl() {
  await recordExport('stl');
  const blob = new Blob([meshToStl(store.meshes, store.title)], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${store.title || 'hicad-model'}.stl`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportObj() {
  await recordExport('obj');
  const blob = new Blob([meshToObj(store.meshes, store.title)], { type: 'model/obj' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${store.title || 'hicad-model'}.obj`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="hex"></span> HiCAD</div>
      <input v-model="store.title" class="title-input" aria-label="模型名称" />
      <div class="auth-strip">
        <input v-model="authEmail" aria-label="邮箱" />
        <input v-model="authPassword" type="password" aria-label="密码" />
        <input v-model="activationCode" aria-label="激活码" />
        <button @click="registerOrLogin('register')">注册</button>
        <button @click="registerOrLogin('login')">登录</button>
      </div>
      <button @click="saveModel">保存</button>
      <button @click="publishModel">发布</button>
      <button @click="exportStl">STL</button>
      <button @click="exportObj">OBJ</button>
      <button @click="shareModel">分享</button>
    </header>
    <section class="workspace">
      <AiPanel />
      <div class="center-stack">
        <ThreeViewer />
        <CodeEditor />
      </div>
      <div class="right-stack">
        <div class="side-tabs">
          <button :class="{ active: rightPanel === 'params' }" @click="rightPanel = 'params'">参数</button>
          <button :class="{ active: rightPanel === 'market' }" @click="rightPanel = 'market'">市场</button>
        </div>
        <ParameterPanel v-if="rightPanel === 'params'" />
        <MarketPanel v-else />
      </div>
    </section>
    <footer class="statusbar">{{ status || '就绪 · Worker 隔离解析 · 浏览器端渲染' }}</footer>
  </main>
</template>
