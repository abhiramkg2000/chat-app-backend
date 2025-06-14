import { NestFactory } from '@nestjs/core';

import { ChatModule } from './chat/chat.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);

  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
