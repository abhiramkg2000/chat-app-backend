import { Controller, Get } from '@nestjs/common';

import { RoomService } from './room.service';

@Controller()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('rooms')
  getRoomIds() {
    return this.roomService.getRoomIds();
  }
}
