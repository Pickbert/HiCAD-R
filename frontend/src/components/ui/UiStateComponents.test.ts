import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('common UI state components', () => {
  it('renders loading, empty, and error states with accessible roles', async () => {
    const loading = await readComponent('LoadingState.vue');
    const empty = await readComponent('EmptyState.vue');
    const error = await readComponent('ErrorState.vue');

    expect(loading).toContain('aria-busy="true"');
    expect(empty).toContain('role="status"');
    expect(error).toContain('role="alert"');
  });

  it('renders confirm dialog and toast announcements accessibly', async () => {
    const dialog = await readComponent('ConfirmDialog.vue');
    const toasts = await readComponent('ToastStack.vue');

    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('data-testid="confirm-accept"');
    expect(toasts).toContain('aria-live="polite"');
    expect(toasts).toContain('role="status"');
  });
});

function readComponent(fileName: string) {
  return readFile(fileURLToPath(new URL(fileName, import.meta.url)), 'utf8');
}
