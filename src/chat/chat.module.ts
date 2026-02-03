import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';

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
    ConfigModule.forRoot({
      isGlobal: true, // makes env available everywhere
    }),
    MongooseModule.forRoot(process.env.MONGO_DB_ATLAS_URI!),
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Room.name, schema: RoomSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.register({
      // global: true, // make JwtService globally available
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
