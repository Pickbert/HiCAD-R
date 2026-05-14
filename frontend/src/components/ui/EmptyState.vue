<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    detail?: string;
    compact?: boolean;
  }>(),
  {
    detail: '',
    compact: false
  }
);
</script>

<template>
  <div :class="['empty', { compact }]" role="status">
    <strong>{{ title }}</strong>
    <span v-if="detail">{{ detail }}</span>
  </div>
</template>
