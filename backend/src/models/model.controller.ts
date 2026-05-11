import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtGuard, OptionalJwtGuard } from '../common/jwt.guard.js';
import type { StoredUser } from '../domain.js';
import { ImportStlDto, PublishDto, SaveModelDto } from './model.dto.js';
import { ModelService } from './model.service.js';

@Controller('models')
export class ModelController {
  constructor(private readonly models: ModelService) {}

  @UseGuards(OptionalJwtGuard)
  @Get('market')
  market(@Query() query: { q?: string; category?: string; tag?: string }) {
    return this.models.market(query);
  }

  @UseGuards(JwtGuard)
  @Post('market/:id/like')
  like(@Param('id') id: string, @CurrentUser() user: StoredUser) {
    return this.models.like(id, user);
  }

  @UseGuards(JwtGuard)
  @Get()
  mine(@CurrentUser() user: StoredUser) {
    return this.models.listMine(user);
  }

  @UseGuards(JwtGuard)
  @Post()
  create(@CurrentUser() user: StoredUser, @Body() dto: SaveModelDto) {
    return this.models.create(user, dto);
  }

  @UseGuards(JwtGuard)
  @Post('import/stl')
  importStl(@CurrentUser() user: StoredUser, @Body() dto: ImportStlDto) {
    return this.models.importStl(user, dto);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('share/:token')
  getShare(@Param('token') token: string) {
    return this.models.getShare(token);
  }

  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.models.get(id, req.user);
  }

  @UseGuards(JwtGuard)
  @Put(':id')
  update(@CurrentUser() user: StoredUser, @Param('id') id: string, @Body() dto: SaveModelDto) {
    return this.models.update(user, id, dto);
  }

  @UseGuards(JwtGuard)
  @Delete(':id')
  remove(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.remove(user, id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/publish')
  publish(@CurrentUser() user: StoredUser, @Param('id') id: string, @Body() _dto: PublishDto) {
    return this.models.publish(user, id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/unpublish')
  unpublish(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.unpublish(user, id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/share')
  share(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.share(user, id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/export')
  recordExport(@CurrentUser() user: StoredUser, @Param('id') id: string, @Body() body: { format?: 'stl' | 'obj' }) {
    return this.models.recordExport(user, id, body.format === 'obj' ? 'obj' : 'stl');
  }

  @UseGuards(JwtGuard)
  @Get(':id/revisions')
  revisions(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.revisions(user, id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/revisions/:revisionId/restore')
  restoreRevision(@CurrentUser() user: StoredUser, @Param('id') id: string, @Param('revisionId') revisionId: string) {
    return this.models.restoreRevision(user, id, revisionId);
  }
}
