import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';

import { ChatModule } from './chat/chat.module';

import { getAllowedOrigins } from './constants/commonConstants';

console.log('allowed origins:', getAllowedOrigins());

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);

  app.enableCors({
    origin: getAllowedOrigins(),
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
    credentials: true,
  });

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
