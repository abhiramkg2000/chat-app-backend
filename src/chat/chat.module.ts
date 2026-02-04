import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from 'src/auth/auth.module';
import { ChatGateway } from './chat-gateway';
import { RoomModule } from 'src/room/room.module';
import { UserModule } from 'src/user/user.module';
import { PingModule } from 'src/ping/ping.module';
import { RedisModule } from 'src/redis/redis.module';

import { Message, MessageSchema } from 'src/message/message.schema';
import { User, UserSchema } from 'src/user/user.schema';
import { Room, RoomSchema } from 'src/room/room.schema';

@Module({
  imports: [
    RoomModule,
    UserModule,
    PingModule,
    RedisModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true, // makes env available everywhere
    }),
    MongooseModule.forRoot(process.env.MONGO_DB_ATLAS_URI!),
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Room.name, schema: RoomSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
