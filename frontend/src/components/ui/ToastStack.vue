<script setup lang="ts">
defineProps<{
  toasts: Array<{ id: number; type: 'info' | 'success' | 'error'; text: string }>;
}>();
</script>

<template>
  <div class="toast-stack" aria-live="polite" aria-relevant="additions">
    <div v-for="toast in toasts" :key="toast.id" :class="['toast', toast.type]" role="status">{{ toast.text }}</div>
  </div>
</template>
