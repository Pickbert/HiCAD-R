<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace.js';

const store = useWorkspaceStore();
</script>

<template>
  <aside class="parameter-panel">
    <div class="section-label">参数控制</div>
    <div v-if="store.parameters.length === 0" class="empty compact">当前代码没有参数注释协议</div>
    <label v-for="parameter in store.parameters" :key="parameter.name" class="parameter-card">
      <span class="parameter-name">
        <strong>{{ parameter.name }}</strong>
        <small>{{ parameter.label }}</small>
      </span>
      <span class="parameter-value">{{ parameter.value }} {{ parameter.unit }}</span>
      <input
        type="range"
        :min="parameter.min"
        :max="parameter.max"
        :step="parameter.step"
        :value="parameter.value"
        @input="store.updateParameter(parameter, Number(($event.target as HTMLInputElement).value))"
      />
      <input
        type="number"
        :min="parameter.min"
        :max="parameter.max"
        :step="parameter.step"
        :value="parameter.value"
        @change="store.updateParameter(parameter, Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </aside>
</template>
