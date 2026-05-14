import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { OptionalJwtGuard } from '../common/jwt.guard.js';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { nowIso } from '../domain.js';

class FeedbackDto {
  @IsString()
  @MinLength(3)
  content!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

@Controller('feedback')
export class FeedbackController {
  constructor(@Inject(JsonDatabaseService) private readonly db: JsonDatabaseService) {}

  @UseGuards(OptionalJwtGuard)
  @Post()
  create(@Body() body: FeedbackDto, @Req() req: any) {
    return this.db.mutate((state) => {
      const feedback = {
        id: crypto.randomUUID(),
        userId: req.user?.id,
        email: body.email,
        content: body.content,
        status: 'open' as const,
        createdAt: nowIso()
      };
      state.feedbacks.push(feedback);
      return feedback;
    });
  }
}
