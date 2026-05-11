import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { JsonDatabaseService } from './database/json-database.service.js';
import { JwtGuard, OptionalJwtGuard } from './common/jwt.guard.js';
import { AdminGuard } from './common/admin.guard.js';
import { UserController } from './users/user.controller.js';
import { AiController } from './ai/ai.controller.js';
import { AiService } from './ai/ai.service.js';
import { ModelController } from './models/model.controller.js';
import { ModelService } from './models/model.service.js';
import { TemplateController } from './templates/template.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { PayController } from './pay/pay.controller.js';
import { FeedbackController } from './feedback/feedback.controller.js';
import { HealthController } from './health/health.controller.js';
import { requestContextMiddleware } from './common/request-context.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: () => ({})
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])
  ],
  controllers: [
    AuthController,
    UserController,
    AiController,
    ModelController,
    TemplateController,
    AdminController,
    PayController,
    FeedbackController,
    HealthController
  ],
  providers: [JsonDatabaseService, AuthService, JwtGuard, OptionalJwtGuard, AdminGuard, AiService, ModelService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestContextMiddleware).forRoutes('*');
  }
}
