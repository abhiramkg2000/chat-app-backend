import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true, versionKey: false })
export class Message {
  @Prop()
  name: string;

  @Prop()
  value: string;

  @Prop()
  clientId: string;

  @Prop()
  messageId: string;

  @Prop()
  roomId: string;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop()
  editedAt: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  replyTo: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
