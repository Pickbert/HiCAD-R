<script setup lang="ts">
withDefaults(defineProps<{ label?: string; compact?: boolean }>(), {
  label: '加载中',
  compact: false
});
</script>

<template>
  <div :class="['loading-state', { compact }]" role="status" aria-busy="true">
    <span class="loading-spinner" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </div>
</template>
