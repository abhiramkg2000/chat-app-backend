import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';

import { ChatModule } from './chat/chat.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);

  // app.enableCors({
  //   // allowedHeaders: '*',
  //   allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
  //   // origin: '*',
  //   origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000', // frontend origin
  //   credentials: true, // allow cookies to be sent
  // });

  const allowedOrigins = [
    'http://localhost:3000',
    'https://use-chat-app.netlify.app',
  ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
    credentials: true,
  });

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
