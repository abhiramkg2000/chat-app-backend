import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true, versionKey: false })
export class Room {
  @Prop({ unique: true })
  roomId: string;

  @Prop()
  createdBy: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
