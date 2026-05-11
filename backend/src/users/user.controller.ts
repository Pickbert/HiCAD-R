import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtGuard } from '../common/jwt.guard.js';
import { toPublicUser } from '../auth/auth.service.js';
import type { StoredUser } from '../domain.js';

@Controller('users')
export class UserController {
  @UseGuards(JwtGuard)
  @Get('me')
  me(@CurrentUser() user: StoredUser) {
    return toPublicUser(user);
  }
}
