import { Module } from '@nestjs/common';

import { ChatGateway } from './chat-gateway';
import { RoomModule } from 'src/room/room.module';

@Module({
  imports: [RoomModule],
  providers: [ChatGateway],
})
export class ChatModule {}
