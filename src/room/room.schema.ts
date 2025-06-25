import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ versionKey: false })
export class Room {
  @Prop()
  roomId: string;

  @Prop({ type: [String] })
  userIds: string[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);
