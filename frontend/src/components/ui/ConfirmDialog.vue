<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
  }>(),
  {
    confirmLabel: '确认',
    cancelLabel: '取消',
    busy: false
  }
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <section
    v-if="open"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="`${title}-dialog-title`"
    tabindex="-1"
    @click.self="emit('cancel')"
    @keydown.esc.prevent="emit('cancel')"
  >
    <div class="modal confirm-dialog">
      <div class="modal-header">
        <strong :id="`${title}-dialog-title`">{{ title }}</strong>
        <button type="button" aria-label="关闭确认弹窗" @click="emit('cancel')">x</button>
      </div>
      <div class="confirm-body">
        <slot />
      </div>
      <div class="card-actions confirm-actions">
        <button type="button" :disabled="busy" :aria-label="cancelLabel" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button data-testid="confirm-accept" class="primary-action" type="button" :disabled="busy" :aria-label="confirmLabel" @click="emit('confirm')">
          {{ busy ? '处理中' : confirmLabel }}
        </button>
      </div>
    </div>
  </section>
</template>
