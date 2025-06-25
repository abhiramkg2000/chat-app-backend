import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { ChatGateway } from './chat-gateway';
import { RoomModule } from 'src/room/room.module';

import { Message, MessageSchema } from 'src/message/message.schema';
import { User, UserSchema } from 'src/user/user.schema';

@Module({
  imports: [
    RoomModule,
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_DB_ATLAS_URI!),
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
