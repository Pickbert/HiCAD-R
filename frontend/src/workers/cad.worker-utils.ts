import { CadRuntimeError } from '../utils/cadRuntime.js';

export interface StructuredWorkerError {
  code: string;
  message: string;
  hint: string;
}

export function toStructuredWorkerError(error: unknown): StructuredWorkerError {
  if (error instanceof CadRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      hint: error.hint
    };
  }
  return {
    code: 'JSCAD_ERROR',
    message: error instanceof Error ? error.message : String(error),
    hint: '请检查 JSCAD 代码语法和 main() 返回值。'
  };
}

export function createRenderTimeoutController(timeoutMs: number, onTimeout: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    start() {
      this.clear();
      timer = setTimeout(onTimeout, timeoutMs);
    },
    clear() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    }
  };
}
