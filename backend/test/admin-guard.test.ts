import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AdminGuard } from '../src/common/admin.guard.js';

function contextWithUser(user: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user })
    })
  } as any;
}

describe('AdminGuard', () => {
  it('rejects ordinary users and accepts role-based admins', () => {
    const guard = new AdminGuard();

    expect(() => guard.canActivate(contextWithUser({ role: 'user' }))).toThrow(ForbiddenException);
    expect(guard.canActivate(contextWithUser({ role: 'admin' }))).toBe(true);
  });
});
