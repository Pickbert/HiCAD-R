import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtGuard } from '../common/jwt.guard.js';
import { toPublicUser } from '../auth/auth.service.js';
import type { StoredUser } from '../domain.js';

@ApiTags('users')
@Controller('users')
export class UserController {
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read the current user profile' })
  @UseGuards(JwtGuard)
  @Get('me')
  me(@CurrentUser() user: StoredUser) {
    return toPublicUser(user);
  }
}
