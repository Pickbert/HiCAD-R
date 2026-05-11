import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
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
