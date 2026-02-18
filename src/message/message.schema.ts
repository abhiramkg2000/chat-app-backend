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

  @Prop({ unique: true })
  messageId: string;

  @Prop()
  roomId: string;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  replyTo: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ roomId: 1, createdAt: -1 });
