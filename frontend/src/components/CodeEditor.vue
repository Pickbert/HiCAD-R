<script setup lang="ts">
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWorkspaceStore } from '../stores/workspace.js';

const store = useWorkspaceStore();
const host = ref<HTMLDivElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let completionProvider: monaco.IDisposable | undefined;
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
  completionProvider = monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['c', 'r', 't', 'u', 's'],
    provideCompletionItems: (model, position) => {
      const range = model.getWordUntilPosition(position);
      const replaceRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: range.startColumn,
        endColumn: range.endColumn
      };
      return {
        suggestions: snippets(replaceRange)
      };
    }
  });
  validateModel();
  editor.onDidChangeModelContent(() => {
    if (applyingExternalChange) return;
    window.clearTimeout((editor as any).__hicadDebounce);
    (editor as any).__hicadDebounce = window.setTimeout(() => {
      store.setCode(editor?.getValue() ?? '');
      validateModel();
    }, 300);
  });
});

watch(
  () => store.code,
  (code) => {
    if (!editor || editor.getValue() === code) return;
    applyingExternalChange = true;
    editor.setValue(code);
    validateModel();
    applyingExternalChange = false;
  }
);

onBeforeUnmount(() => {
  completionProvider?.dispose();
  editor?.dispose();
});

function validateModel() {
  const model = editor?.getModel();
  if (!model) return;
  const code = model.getValue();
  const markers: monaco.editor.IMarkerData[] = [];
  if (!/\bfunction\s+main\s*\(/.test(code) && !/module\.exports\.main/.test(code)) {
    markers.push({
      severity: monaco.MarkerSeverity.Warning,
      message: 'JSCAD 代码需要定义 main() 或导出 module.exports.main',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 2
    });
  }
  if (/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|eval|Function)\b/.test(code)) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: '模型代码不能访问网络、浏览器存储或动态执行能力',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: Math.max(1, model.getLineCount()),
      endColumn: 1
    });
  }
  monaco.editor.setModelMarkers(model, 'hicad', markers);
}

function snippets(range: monaco.IRange): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'hicad: parameter',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'const ${1:boxWidth} = ${2:80} // ${3:主体/宽度} unit:mm min:${4:10} max:${5:200} step:${6:5}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'HiCAD 参数注释协议',
      range
    },
    {
      label: 'jscad: rounded box',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'roundedCuboid({ size: [${1:80}, ${2:50}, ${3:30}], roundRadius: ${4:4}, segments: ${5:16} })',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: '圆角盒子',
      range
    },
    {
      label: 'jscad: transform',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'translate([${1:0}, ${2:0}, ${3:0}], ${4:geometry})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: '平移几何体',
      range
    },
    {
      label: 'jscad: union',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'union(${1:partA}, ${2:partB})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: '合并几何体',
      range
    },
    {
      label: 'jscad: material',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: '// @material: ${1|cad-blue,silver,gold,copper,ceramic,glass,neon,matte-black,white,steel|}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: '模型级材质注释',
      range
    }
  ];
}
</script>

<template>
  <section class="code-panel">
    <div class="section-label">参数化代码</div>
    <div ref="host" class="editor-host"></div>
  </section>
</template>
