<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AdminDashboard from './components/AdminDashboard.vue';
import AiPanel from './components/AiPanel.vue';
import AuthModal from './components/AuthModal.vue';
import CodeEditor from './components/CodeEditor.vue';
import MarketPanel from './components/MarketPanel.vue';
import ModelLibrary from './components/ModelLibrary.vue';
import ParameterPanel from './components/ParameterPanel.vue';
import SharePreview from './components/SharePreview.vue';
import ThreeViewer from './components/ThreeViewer.vue';
import { apiFetch, fileToBase64Payload, importStl, listMine, me } from './api.js';
import { useWorkspaceStore } from './stores/workspace.js';
import { meshToObj, meshToStl } from './utils/mesh.js';

const store = useWorkspaceStore();
const rightPanel = ref<'params' | 'market'>('params');
const showAuth = ref(false);
const stlInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  store.initAuth();
  syncRouteFromLocation();
  window.addEventListener('hashchange', syncRouteFromLocation);
  if (store.accessToken) {
    void me(store.apiAuth())
      .then((user) => {
        store.user = user;
      })
      .catch(() => store.logout());
  }
});

onBeforeUnmount(() => window.removeEventListener('hashchange', syncRouteFromLocation));

function syncRouteFromLocation() {
  const hashPath = window.location.hash.replace(/^#\/?/, '');
  const directShare = /^\/share\/([^/]+)/.exec(window.location.pathname)?.[1];
  const path = directShare ? `share/${directShare}` : hashPath;
  if (path.startsWith('share/')) {
    store.routeView = 'share';
    store.shareToken = decodeURIComponent(path.slice('share/'.length));
  } else if (path === 'market' || path === 'models' || path === 'admin') {
    store.routeView = path;
  } else {
    store.routeView = 'workspace';
  }
}

async function saveModel() {
  if (!store.accessToken) {
    showAuth.value = true;
    store.toast('error', '请先登录后再保存模型');
    return undefined;
  }
  store.saving = true;
  try {
    const model = await apiFetch<any>(
      store.currentModelId ? `/models/${store.currentModelId}` : '/models',
      {
        method: store.currentModelId ? 'PUT' : 'POST',
        body: JSON.stringify({
          title: store.title,
          description: 'HiCAD 工作台保存的参数化模型',
          code: store.code,
          material: store.material,
          category: 'workspace',
          tags: ['HiCAD']
        })
      },
      store.apiAuth()
    );
    store.currentModelId = model.id;
    store.toast('success', '模型已保存');
    await refreshMine();
    return model;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '保存失败';
    store.toast('error', message);
    throw caught;
  } finally {
    store.saving = false;
  }
}

async function publishModel() {
  store.publishing = true;
  try {
    if (!store.currentModelId) {
      const saved = await saveModel();
      if (!saved) return;
    }
    await apiFetch(`/models/${store.currentModelId}/publish`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) }, store.apiAuth());
    store.toast('success', '模型已发布到市场');
    await refreshMine();
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : '发布失败');
  } finally {
    store.publishing = false;
  }
}

async function shareModel() {
  store.sharing = true;
  try {
    if (!store.currentModelId) {
      const saved = await saveModel();
      if (!saved) return;
    }
    const share = await apiFetch<any>(`/models/${store.currentModelId}/share`, { method: 'POST' }, store.apiAuth());
    const link = `#/share/${share.token}`;
    store.toast('success', `分享链接：${link}`);
    await refreshMine();
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : '分享失败');
  } finally {
    store.sharing = false;
  }
}

async function recordExport(format: 'stl' | 'obj') {
  if (store.currentModelId && store.accessToken) {
    await apiFetch(`/models/${store.currentModelId}/export`, { method: 'POST', body: JSON.stringify({ format }) }, store.apiAuth());
  }
}

async function exportStl() {
  try {
    await recordExport('stl');
    downloadBlob(meshToStl(store.meshes, store.title), 'model/stl', 'stl');
    store.toast('success', 'STL 已导出');
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : 'STL 导出失败');
  }
}

async function exportObj() {
  try {
    await recordExport('obj');
    downloadBlob(meshToObj(store.meshes, store.title), 'model/obj', 'obj');
    store.toast('success', 'OBJ 已导出');
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : 'OBJ 导出失败');
  }
}

async function importSelectedStl(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!store.accessToken) {
    showAuth.value = true;
    store.toast('error', '请先登录后再导入 STL');
    return;
  }
  store.importing = true;
  try {
    const model = await importStl(await fileToBase64Payload(file, store.title), store.apiAuth());
    store.applyModel(model);
    store.toast('success', 'STL 已导入并保存为模型');
    await refreshMine();
  } catch (caught) {
    store.toast('error', caught instanceof Error ? caught.message : 'STL 导入失败');
  } finally {
    store.importing = false;
    if (stlInput.value) stlInput.value.value = '';
  }
}

async function refreshMine() {
  if (!store.accessToken) return;
  store.myModels = await listMine(store.apiAuth());
}

function downloadBlob(content: string, type: string, extension: 'stl' | 'obj') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${store.title || 'hicad-model'}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="hex"></span> HiCAD</div>
      <input v-model="store.title" class="title-input" aria-label="模型名称" />
      <nav class="top-nav" aria-label="主导航">
        <button :class="{ active: store.routeView === 'workspace' }" @click="store.navigate('workspace')">工作台</button>
        <button :class="{ active: store.routeView === 'market' }" @click="store.navigate('market')">市场</button>
        <button :class="{ active: store.routeView === 'models' }" @click="store.navigate('models')">我的模型</button>
        <button :class="{ active: store.routeView === 'admin' }" @click="store.navigate('admin')">后台</button>
      </nav>
      <div class="auth-area">
        <span v-if="store.user">{{ store.user.displayName }}</span>
        <button v-if="store.user" @click="store.logout">退出</button>
        <button v-else @click="showAuth = true">登录/注册</button>
      </div>
      <button :disabled="store.saving" @click="saveModel">保存</button>
      <button :disabled="store.publishing" @click="publishModel">发布</button>
      <button @click="exportStl">STL</button>
      <button @click="exportObj">OBJ</button>
      <button :disabled="store.sharing" @click="shareModel">分享</button>
      <button :disabled="store.importing" @click="stlInput?.click()">导入 STL</button>
      <input ref="stlInput" class="hidden-input" type="file" accept=".stl,model/stl" @change="importSelectedStl" />
    </header>
    <section v-if="store.routeView === 'workspace'" class="workspace">
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
        <div v-if="rightPanel === 'params'" class="right-panel-scroll">
          <div class="annotation-panel">
            <div class="section-label">标注</div>
            <label><input v-model="store.annotationSettings.dimensions" type="checkbox" /> 尺寸标注</label>
            <label><input v-model="store.annotationSettings.parameterLabels" type="checkbox" /> 参数标签</label>
            <label><input v-model="store.annotationSettings.axes" type="checkbox" /> 坐标轴</label>
            <label><input v-model="store.annotationSettings.grid" type="checkbox" /> 网格</label>
          </div>
          <ParameterPanel />
        </div>
        <MarketPanel v-else embedded />
      </div>
    </section>
    <MarketPanel v-else-if="store.routeView === 'market'" />
    <ModelLibrary v-else-if="store.routeView === 'models'" />
    <AdminDashboard v-else-if="store.routeView === 'admin'" />
    <SharePreview v-else-if="store.routeView === 'share'" :token="store.shareToken" />
    <div class="toast-stack">
      <div v-for="toast in store.toasts" :key="toast.id" :class="['toast', toast.type]">{{ toast.text }}</div>
    </div>
    <AuthModal v-if="showAuth" @close="showAuth = false" />
    <footer class="statusbar">{{ store.status || '就绪 · Worker 隔离解析 · 浏览器端渲染' }}</footer>
  </main>
</template>
