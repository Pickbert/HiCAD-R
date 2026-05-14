<script setup lang="ts">
import { ref } from 'vue';
import { login, register } from '../api.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import ErrorState from './ui/ErrorState.vue';

const emit = defineEmits<{ close: [] }>();
const store = useWorkspaceStore();
const mode = ref<'login' | 'register'>('login');
const email = ref('demo@hicad.local');
const password = ref('password123');
const activationCode = ref('local-dev-code');
const loading = ref(false);
const error = ref('');

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const auth =
      mode.value === 'login'
        ? await login(email.value, password.value)
        : await register(email.value, password.value, activationCode.value);
    store.setAuth(auth);
    store.toast('success', `${auth.user.displayName} 已登录`);
    emit('close');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="modal-backdrop" role="presentation" @click.self="emit('close')">
    <form
      class="modal auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      @keydown.esc.prevent="emit('close')"
      @submit.prevent="submit"
    >
      <div class="modal-header">
        <strong id="auth-title">{{ mode === 'login' ? '登录 HiCAD' : '注册 HiCAD' }}</strong>
        <button type="button" aria-label="关闭登录弹窗" @click="emit('close')">x</button>
      </div>
      <div class="segmented">
        <button type="button" :class="{ active: mode === 'login' }" aria-label="切换到登录模式" @click="mode = 'login'">
          登录
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          aria-label="切换到注册模式"
          @click="mode = 'register'"
        >
          注册
        </button>
      </div>
      <label>
        <span>邮箱</span>
        <input v-model.trim="email" type="email" autocomplete="email" required />
      </label>
      <label>
        <span>密码</span>
        <input v-model="password" type="password" autocomplete="current-password" minlength="6" required />
      </label>
      <label v-if="mode === 'register'">
        <span>激活码</span>
        <input v-model.trim="activationCode" autocomplete="off" required />
      </label>
      <ErrorState v-if="error" :message="error" />
      <button
        class="primary-action"
        :disabled="loading"
        type="submit"
        :aria-label="mode === 'login' ? '登录 HiCAD' : '注册并登录 HiCAD'"
      >
        {{ loading ? '处理中' : mode === 'login' ? '登录' : '注册并登录' }}
      </button>
    </form>
  </div>
</template>
