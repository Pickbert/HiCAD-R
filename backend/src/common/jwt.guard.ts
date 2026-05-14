import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { getRequiredSecret } from '../security/runtime-security.js';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(JsonDatabaseService) private readonly db: JsonDatabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('missing bearer token');
    }
    const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
      secret: getRequiredSecret(
        'JWT_ACCESS_SECRET',
        this.config.get('JWT_ACCESS_SECRET'),
        'development-access-secret-with-32-chars'
      )
    });
    const user = this.db.data.users.find((entry) => entry.id === payload.sub);
    if (!user) {
      throw new UnauthorizedException('user no longer exists');
    }
    request.user = user;
    return true;
  }
}

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(JsonDatabaseService) private readonly db: JsonDatabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return true;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: getRequiredSecret(
          'JWT_ACCESS_SECRET',
          this.config.get('JWT_ACCESS_SECRET'),
          'development-access-secret-with-32-chars'
        )
      });
      request.user = this.db.data.users.find((entry) => entry.id === payload.sub);
    } catch {
      request.user = undefined;
    }
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return match?.[1];
}
