import type { AiStreamEvent } from '@hicad/shared';

export interface UiMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  streaming?: boolean;
}

export interface CodeDiffSummary {
  added: number;
  removed: number;
  changed: number;
  preview: string[];
}

export function mergeAiStreamEvent(messages: UiMessage[], event: AiStreamEvent): UiMessage[] {
  if (event.type === 'delta' && event.delta) {
    const next = [...messages];
    const last = next[next.length - 1];
    if (last?.role === 'assistant' && last.streaming) {
      next[next.length - 1] = { ...last, text: `${last.text}${event.delta}` };
      return next;
    }
    next.push({ role: 'assistant', text: event.delta, streaming: true });
    return next;
  }
  if (event.type === 'done') {
    return messages.map((message, index) => (index === messages.length - 1 && message.streaming ? { ...message, streaming: false } : message));
  }
  if (event.type === 'error' || event.type === 'retry' || event.type === 'fallback' || event.type === 'start' || event.type === 'spec') {
    const text = event.message ?? statusText(event);
    return text ? [...messages, { role: event.type === 'error' ? 'system' : 'assistant', text }] : messages;
  }
  return messages;
}

export function buildCodeDiffSummary(before: string, after: string, maxPreviewLines = 6): CodeDiffSummary {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const addedLines = afterLines.filter((line) => !beforeSet.has(line) && line.trim());
  const removedLines = beforeLines.filter((line) => !afterSet.has(line) && line.trim());
  const changed = Math.min(addedLines.length, removedLines.length);
  const preview = [
    ...addedLines.slice(0, Math.ceil(maxPreviewLines / 2)).map((line) => `+ ${line}`),
    ...removedLines.slice(0, Math.floor(maxPreviewLines / 2)).map((line) => `- ${line}`)
  ].slice(0, maxPreviewLines);
  return {
    added: addedLines.length,
    removed: removedLines.length,
    changed,
    preview
  };
}

export function summarizeAiEvent(event: AiStreamEvent): string {
  if (event.type === 'retry') return `重试 ${event.attempt ?? 1}/${event.maxAttempts ?? '?'} · ${event.retryInMs ?? 0}ms`;
  if (event.type === 'spec') return '已解析建模规格';
  if (event.type === 'code') return '已生成代码，等待应用';
  if (event.type === 'fallback') return event.message ?? '第三方 AI 不可用，已切换本地 fallback';
  return event.message ?? statusText(event);
}

function statusText(event: AiStreamEvent): string {
  const labels: Record<string, string> = {
    start: '开始生成',
    done: '完成',
    error: '生成失败',
    retry: '正在重试',
    spec: '规格已生成',
    fallback: 'Fallback 已启用'
  };
  return labels[event.type] ?? '';
}
