import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtGuard, OptionalJwtGuard } from '../common/jwt.guard.js';
import type { StoredUser } from '../domain.js';
import { ImportStlDto, PublishDto, SaveModelDto } from './model.dto.js';
import { ModelService } from './model.service.js';

@ApiTags('models')
@Controller('models')
export class ModelController {
  constructor(@Inject(ModelService) private readonly models: ModelService) {}

  @ApiOperation({ summary: 'Search public marketplace models' })
  @UseGuards(OptionalJwtGuard)
  @Get('market')
  market(@Query() query: { q?: string; category?: string; tag?: string }) {
    return this.models.market(query);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a marketplace model' })
  @UseGuards(JwtGuard)
  @Post('market/:id/like')
  like(@Param('id') id: string, @CurrentUser() user: StoredUser) {
    return this.models.like(id, user);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List models owned by the current user' })
  @UseGuards(JwtGuard)
  @Get()
  mine(@CurrentUser() user: StoredUser) {
    return this.models.listMine(user);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a model' })
  @UseGuards(JwtGuard)
  @Post()
  create(@CurrentUser() user: StoredUser, @Body() dto: SaveModelDto) {
    return this.models.create(user, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import an STL payload as a model asset' })
  @UseGuards(JwtGuard)
  @Post('import/stl')
  importStl(@CurrentUser() user: StoredUser, @Body() dto: ImportStlDto) {
    return this.models.importStl(user, dto);
  }

  @ApiOperation({ summary: 'Read a shared model by token' })
  @UseGuards(OptionalJwtGuard)
  @Get('share/:token')
  getShare(@Param('token') token: string) {
    return this.models.getShare(token);
  }

  @ApiOperation({ summary: 'Read a model by id' })
  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.models.get(id, req.user);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a model' })
  @UseGuards(JwtGuard)
  @Put(':id')
  update(@CurrentUser() user: StoredUser, @Param('id') id: string, @Body() dto: SaveModelDto) {
    return this.models.update(user, id, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a model' })
  @UseGuards(JwtGuard)
  @Delete(':id')
  remove(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.remove(user, id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a model' })
  @UseGuards(JwtGuard)
  @Post(':id/publish')
  publish(@CurrentUser() user: StoredUser, @Param('id') id: string, @Body() _dto: PublishDto) {
    return this.models.publish(user, id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Withdraw a published model' })
  @UseGuards(JwtGuard)
  @Post(':id/unpublish')
  unpublish(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.unpublish(user, id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or fetch a share token' })
  @UseGuards(JwtGuard)
  @Post(':id/share')
  share(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.share(user, id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a model export' })
  @UseGuards(JwtGuard)
  @Post(':id/export')
  recordExport(@CurrentUser() user: StoredUser, @Param('id') id: string, @Body() body: { format?: 'stl' | 'obj' }) {
    return this.models.recordExport(user, id, body.format === 'obj' ? 'obj' : 'stl');
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List model revisions' })
  @UseGuards(JwtGuard)
  @Get(':id/revisions')
  revisions(@CurrentUser() user: StoredUser, @Param('id') id: string) {
    return this.models.revisions(user, id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore a model revision' })
  @UseGuards(JwtGuard)
  @Post(':id/revisions/:revisionId/restore')
  restoreRevision(@CurrentUser() user: StoredUser, @Param('id') id: string, @Param('revisionId') revisionId: string) {
    return this.models.restoreRevision(user, id, revisionId);
  }
}
