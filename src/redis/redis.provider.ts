import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST, // Redis Cloud host
      port: Number(process.env.REDIS_PORT), // Redis Cloud port
      username: process.env.REDIS_USERNAME, // Redis Cloud DB username (usually "default")
      password: process.env.REDIS_PASSWORD, // Redis Cloud DB password
      retryStrategy(times) {
        return Math.min(times * 50, 2000); // Reconnect strategy
      },
    });
  },
};
