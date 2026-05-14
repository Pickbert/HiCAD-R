import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import type { User } from '@hicad/shared';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { nowIso, StoredUser } from '../domain.js';
import { hashPassword, verifyPassword } from '../security/passwords.js';
import { getRequiredSecret } from '../security/runtime-security.js';
import type { LoginDto, RefreshDto, RegisterDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(JsonDatabaseService) private readonly db: JsonDatabaseService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    if (this.db.data.users.some((user) => user.email === email)) {
      throw new BadRequestException('email already registered');
    }
    const activation = this.db.data.activationCodes.find((code) => code.code === dto.activationCode.trim());
    if (!activation || activation.disabled || activation.useCount >= activation.maxUses || isExpired(activation.expiresAt)) {
      throw new BadRequestException('invalid activation code');
    }
    const now = nowIso();
    const user: StoredUser = {
      id: uuid(),
      email,
      displayName: dto.displayName?.trim() || email.split('@')[0],
      role: this.db.data.users.length === 0 ? 'admin' : 'user',
      tier: activation.tier,
      passwordHash: await hashPassword(dto.password),
      refreshTokenVersion: 0,
      createdAt: now,
      updatedAt: now
    };
    await this.db.mutate((state) => {
      state.users.push(user);
      activation.useCount += 1;
      activation.usedBy = user.id;
      activation.usedAt = now;
    });
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = this.db.data.users.find((entry) => entry.email === dto.email.trim().toLowerCase());
    if (!user || user.bannedAt || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('invalid email or password');
    }
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthResponse> {
    const payload = await this.jwt.verifyAsync<{ sub: string; version: number }>(dto.refreshToken, {
      secret: this.refreshSecret
    });
    const user = this.db.data.users.find((entry) => entry.id === payload.sub);
    if (!user || user.refreshTokenVersion !== payload.version) {
      throw new UnauthorizedException('invalid refresh token');
    }
    return this.issueTokens(user);
  }

  private async issueTokens(user: StoredUser): Promise<AuthResponse> {
    const safeUser = toPublicUser(user);
    return {
      user: safeUser,
      accessToken: await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role }, { secret: this.accessSecret, expiresIn: '15m' }),
      refreshToken: await this.jwt.signAsync({ sub: user.id, version: user.refreshTokenVersion }, { secret: this.refreshSecret, expiresIn: '30d' })
    };
  }

  private get accessSecret(): string {
    return getRequiredSecret('JWT_ACCESS_SECRET', this.config.get('JWT_ACCESS_SECRET'), 'development-access-secret-with-32-chars');
  }

  private get refreshSecret(): string {
    return getRequiredSecret('JWT_REFRESH_SECRET', this.config.get('JWT_REFRESH_SECRET'), 'development-refresh-secret-with-32-chars');
  }
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export function toPublicUser(user: StoredUser): User {
  const { passwordHash: _passwordHash, refreshTokenVersion: _refreshTokenVersion, ...publicUser } = user;
  return publicUser;
}

function isExpired(expiresAt: string | undefined): boolean {
  return Boolean(expiresAt && Date.parse(expiresAt) < Date.now());
}
