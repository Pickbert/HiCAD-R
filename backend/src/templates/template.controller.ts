import { Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JsonDatabaseService } from '../database/json-database.service.js';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(@Inject(JsonDatabaseService) private readonly db: JsonDatabaseService) {}

  @ApiOperation({ summary: 'List CAD templates' })
  @Get()
  list() {
    return this.db.data.templates;
  }

  @ApiOperation({ summary: 'Read a CAD template' })
  @Get(':id')
  get(@Param('id') id: string) {
    const template = this.db.data.templates.find((entry) => entry.id === id);
    if (!template) throw new NotFoundException('template not found');
    return template;
  }

  @ApiOperation({ summary: 'Use a template as a workspace payload' })
  @Post(':id/use')
  use(@Param('id') id: string) {
    const template = this.db.data.templates.find((entry) => entry.id === id);
    if (!template) throw new NotFoundException('template not found');
    return {
      title: template.title,
      code: template.code,
      material: template.material,
      category: template.category,
      tags: template.tags
    };
  }
}
