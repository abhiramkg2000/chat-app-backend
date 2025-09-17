import { Controller, Get } from '@nestjs/common';

@Controller('ping')
export class PingController {
  @Get()
  ping() {
    console.log('ping received at:', new Date().toLocaleString());
    return { status: 'ok' };
  }
}
