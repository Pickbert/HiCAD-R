import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { OptionalJwtGuard } from '../common/jwt.guard.js';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { nowIso } from '../domain.js';

class FeedbackDto {
  @ApiProperty({ minLength: 3 })
  @IsString()
  @MinLength(3)
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(@Inject(JsonDatabaseService) private readonly db: JsonDatabaseService) {}

  @ApiOperation({ summary: 'Create a feedback item' })
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
