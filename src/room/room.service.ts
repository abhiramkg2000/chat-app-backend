import { Injectable } from '@nestjs/common';

import { roomIds } from 'src/constants/commonConstants';

@Injectable()
export class RoomService {
  getRoomIds(): { rooms: string[] } {
    return { rooms: roomIds };
  }
}
