import { Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { JsonDatabaseService } from '../database/json-database.service.js';

@Controller('templates')
export class TemplateController {
  constructor(@Inject(JsonDatabaseService) private readonly db: JsonDatabaseService) {}

  @Get()
  list() {
    return this.db.data.templates;
  }

  @Get(':id')
  get(@Param('id') id: string) {
    const template = this.db.data.templates.find((entry) => entry.id === id);
    if (!template) throw new NotFoundException('template not found');
    return template;
  }

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
