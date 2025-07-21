import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';

import { ChatModule } from './chat/chat.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);

  app.enableCors({
    // allowedHeaders: '*',
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
    // origin: '*',
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000', // frontend origin
    credentials: true, // allow cookies to be sent
  });

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
