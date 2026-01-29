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
    const dbRooms = await this.roomModel
      .find()
      .select('-_id roomId createdBy')
      .lean();
    console.log('dbRooms', dbRooms);
    return { rooms: dbRooms.map((room) => room.roomId) };
  }
}
