import { Body, Controller, Get, Inject, Post, Query, Req, Sse, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiProvider } from '@hicad/shared';
import { OptionalJwtGuard } from '../common/jwt.guard.js';
import { AiService } from './ai.service.js';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @ApiOperation({ summary: 'Stream AI CAD generation events' })
  @UseGuards(OptionalJwtGuard)
  @Sse('generate')
  generate(
    @Query('prompt') prompt = '',
    @Query('provider') provider?: AiProvider,
    @Query('model') model?: string,
    @Req() req?: any
  ) {
    return this.ai.streamGenerate(prompt, req?.user?.id, provider, model);
  }

  @ApiOperation({ summary: 'Stream AI code modification events' })
  @UseGuards(OptionalJwtGuard)
  @Sse('modify')
  modifyStream(@Body() body: { prompt?: string; code?: string }, @Req() req?: any) {
    return this.ai.streamModify(body.prompt ?? '', body.code ?? '', req?.user?.id);
  }

  @ApiOperation({ summary: 'Modify CAD code with AI and return a final payload' })
  @UseGuards(OptionalJwtGuard)
  @Post('modify')
  modify(@Body() body: { prompt?: string; code?: string }, @Req() req?: any) {
    return this.ai.modify(body.prompt ?? '', body.code ?? '', req?.user?.id);
  }

  @ApiOperation({ summary: 'List AI request history for the current user' })
  @UseGuards(OptionalJwtGuard)
  @Get('history')
  history(@Req() req: any) {
    return this.ai.history(req.user?.id);
  }
}
