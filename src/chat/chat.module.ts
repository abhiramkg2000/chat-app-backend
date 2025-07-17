import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';

import { ChatGateway } from './chat-gateway';
import { RoomModule } from 'src/room/room.module';
import { UserModule } from 'src/user/user.module';

import { Message, MessageSchema } from 'src/message/message.schema';
import { User, UserSchema } from 'src/user/user.schema';

@Module({
  imports: [
    RoomModule,
    UserModule,
    ConfigModule.forRoot({
      isGlobal: true, // makes env available everywhere
    }),
    MongooseModule.forRoot(process.env.MONGO_DB_ATLAS_URI!),
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
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
