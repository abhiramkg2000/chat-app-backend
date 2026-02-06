import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Room, RoomDocument } from './room.schema';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
  ) {}

  async getRoomIds() {
    try {
      // Get all the roomIds from MongoDB
      const dbRoomIds = await this.roomModel.distinct('roomId');
      console.log('dbRoomIds', dbRoomIds);
      return { rooms: dbRoomIds };
    } catch (error) {
      console.error('Failed to fetch room IDs from MongoDB', error);
      return { rooms: [] };
    }
  }
}
