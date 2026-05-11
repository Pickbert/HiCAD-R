<script setup lang="ts">
import { computed } from 'vue';
import type { MaterialPreset } from '@hicad/shared';
import { materialPresets, useWorkspaceStore } from '../stores/workspace.js';
import { groupCadParameters } from '../utils/parameters.js';

const store = useWorkspaceStore();
const groups = computed(() => groupCadParameters(store.code));
const meshMaterials = computed(() => [...new Set(store.meshes.map((mesh) => mesh.material))]);

function updatePartMaterial(part: string, material: string) {
  store.partMaterials[part] = material as MaterialPreset;
}
</script>

<template>
  <aside class="parameter-panel">
    <div class="section-row">
      <div class="section-label">参数控制</div>
      <button :disabled="store.parameters.length === 0" @click="store.resetParameters">重置</button>
    </div>
    <div v-if="groups.length === 0" class="empty compact">当前代码没有参数注释协议</div>
    <section v-for="group in groups" :key="group.name" class="parameter-group">
      <h3>{{ group.name }}</h3>
      <label v-for="parameter in group.parameters" :key="parameter.name" class="parameter-card">
        <span class="parameter-name">
          <strong>{{ parameter.label }}</strong>
          <small>{{ parameter.name }} · {{ parameter.min }}-{{ parameter.max }} {{ parameter.unit || 'unit' }}</small>
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
          :aria-label="`${parameter.label} 数值`"
          @change="store.updateParameter(parameter, Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </section>
    <section class="material-panel">
      <div class="section-label">材质</div>
      <div class="material-grid">
        <button
          v-for="material in materialPresets"
          :key="material.id"
          :class="['swatch-button', { active: store.material === material.id }]"
          :title="material.label"
          :aria-label="material.label"
          @click="store.setMaterial(material.id)"
        >
          <span class="swatch" :style="{ background: material.color }"></span>
        </button>
      </div>
      <label v-for="part in meshMaterials" :key="part" class="part-material">
        <span>{{ part }}</span>
        <select :value="store.partMaterials[part] ?? store.material" @change="updatePartMaterial(part, ($event.target as HTMLSelectElement).value)">
          <option v-for="material in materialPresets" :key="material.id" :value="material.id">{{ material.label }}</option>
        </select>
      </label>
    </section>
  </aside>
</template>
