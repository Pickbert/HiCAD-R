import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Health check' })
  @Get()
  health() {
    return {
      ok: true,
      name: 'HiCAD',
      version: process.env.npm_package_version ?? '1.0.0',
      time: new Date().toISOString()
    };
  }
}
