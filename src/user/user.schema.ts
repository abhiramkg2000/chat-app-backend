import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ versionKey: false })
export class User {
  @Prop({ unique: true })
  name: string;

  @Prop()
  password: string;

  @Prop()
  clientId: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ name: 1 });
