import { describe, expect, it, vi } from 'vitest';
import { CadRuntimeError } from '../utils/cadRuntime.js';
import { createRenderTimeoutController, toStructuredWorkerError } from './cad.worker-utils.js';

describe('CAD worker utilities', () => {
  it('maps runtime and generic errors to structured worker errors', () => {
    expect(toStructuredWorkerError(new CadRuntimeError('UNSAFE_CODE', 'Blocked unsafe token: fetch', 'No network'))).toEqual({
      code: 'UNSAFE_CODE',
      message: 'Blocked unsafe token: fetch',
      hint: 'No network'
    });

    expect(toStructuredWorkerError(new Error('boom'))).toEqual({
      code: 'JSCAD_ERROR',
      message: 'boom',
      hint: '请检查 JSCAD 代码语法和 main() 返回值。'
    });
  });

  it('fires timeout once and supports clearing pending render timers', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const controller = createRenderTimeoutController(100, onTimeout);

    controller.start();
    vi.advanceTimersByTime(99);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    controller.start();
    controller.clear();
    vi.advanceTimersByTime(100);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
