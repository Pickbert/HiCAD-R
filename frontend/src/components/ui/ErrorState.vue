<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<template>
  <p class="error-state error" role="alert">{{ message }}</p>
</template>
