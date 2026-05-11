import { Body, Controller, Get, Post, Query, Req, Sse, UseGuards } from '@nestjs/common';
import { AiProvider } from '@hicad/shared';
import { OptionalJwtGuard } from '../common/jwt.guard.js';
import { AiService } from './ai.service.js';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @UseGuards(OptionalJwtGuard)
  @Sse('generate')
  generate(@Query('prompt') prompt = '', @Query('provider') provider?: AiProvider, @Query('model') model?: string, @Req() req?: any) {
    return this.ai.streamGenerate(prompt, req?.user?.id, provider, model);
  }

  @UseGuards(OptionalJwtGuard)
  @Sse('modify')
  modifyStream(@Body() body: { prompt?: string; code?: string }, @Req() req?: any) {
    return this.ai.streamModify(body.prompt ?? '', body.code ?? '', req?.user?.id);
  }

  @UseGuards(OptionalJwtGuard)
  @Post('modify')
  modify(@Body() body: { prompt?: string; code?: string }, @Req() req?: any) {
    return this.ai.modify(body.prompt ?? '', body.code ?? '', req?.user?.id);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('history')
  history(@Req() req: any) {
    return this.ai.history(req.user?.id);
  }
}
