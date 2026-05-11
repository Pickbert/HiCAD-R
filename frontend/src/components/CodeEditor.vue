<script setup lang="ts">
import * as monaco from 'monaco-editor';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWorkspaceStore } from '../stores/workspace.js';

const store = useWorkspaceStore();
const host = ref<HTMLDivElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let applyingExternalChange = false;

onMounted(() => {
  if (!host.value) return;
  editor = monaco.editor.create(host.value, {
    value: store.code,
    language: 'javascript',
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbersMinChars: 3,
    automaticLayout: true,
    scrollBeyondLastLine: false
  });
  editor.onDidChangeModelContent(() => {
    if (applyingExternalChange) return;
    window.clearTimeout((editor as any).__hicadDebounce);
    (editor as any).__hicadDebounce = window.setTimeout(() => {
      store.setCode(editor?.getValue() ?? '');
    }, 300);
  });
});

watch(
  () => store.code,
  (code) => {
    if (!editor || editor.getValue() === code) return;
    applyingExternalChange = true;
    editor.setValue(code);
    applyingExternalChange = false;
  }
);

onBeforeUnmount(() => editor?.dispose());
</script>

<template>
  <section class="code-panel">
    <div class="section-label">参数化代码</div>
    <div ref="host" class="editor-host"></div>
  </section>
</template>
