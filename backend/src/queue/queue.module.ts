import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import {
  ALERT_BULL_QUEUE,
  ALERT_EVALUATION_QUEUE,
  LOAD_TEST_BULL_QUEUE,
  LOAD_TEST_QUEUE,
  MONITOR_BULL_QUEUE,
  MONITOR_QUEUE,
  NOTIFICATION_BULL_QUEUE,
  NOTIFICATION_QUEUE,
  REDIS_CONNECTION,
} from './queue.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      useFactory: () => {
        let client: Redis;
        let redisUrl = process.env.REDIS_URL ? String(process.env.REDIS_URL).trim() : '';

        // Auto-detect Upstash credentials if REST URL and TOKEN were entered in Render
        if (
          !redisUrl &&
          process.env.UPSTASH_REDIS_REST_URL &&
          process.env.UPSTASH_REDIS_REST_TOKEN
        ) {
          const host = process.env.UPSTASH_REDIS_REST_URL.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
          const token = process.env.UPSTASH_REDIS_REST_TOKEN.trim().replace(/^["']|["']$/g, '');
          redisUrl = `rediss://default:${token}@${host}:6379`;
        }

        if (redisUrl) {
          redisUrl = redisUrl.replace(/^["']|["']$/g, '').trim();
          redisUrl = redisUrl.replace(/^REDIS_URL\s*=\s*/i, '').trim();

          // If someone pasted the https:// URL into REDIS_URL and also provided the token
          if (redisUrl.startsWith('https://') && process.env.UPSTASH_REDIS_REST_TOKEN) {
            const host = redisUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
            const token = process.env.UPSTASH_REDIS_REST_TOKEN.trim().replace(/^["']|["']$/g, '');
            redisUrl = `rediss://default:${token}@${host}:6379`;
          }
        }

        const commonOptions = {
          maxRetriesPerRequest: null, // Required by BullMQ
          enableReadyCheck: false,
          keepAlive: 10000,
          connectTimeout: 10000,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
        };

        if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))) {
          client = new Redis(redisUrl, commonOptions);
        } else {
          const host = process.env.REDIS_HOST || 'localhost';
          const port = parseInt(process.env.REDIS_PORT || '6380', 10);
          client = new Redis({
            host,
            port,
            ...commonOptions,
          });
        }

        client.on('error', (err) => {
          console.warn('[Redis] Connection event:', err.message);
        });
        return client;
      },
    },
    {
      provide: MONITOR_BULL_QUEUE,
      useFactory: (redisConnection: Redis) => {
        return new Queue(MONITOR_QUEUE, {
          connection: redisConnection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        });
      },
      inject: [REDIS_CONNECTION],
    },
    {
      provide: ALERT_BULL_QUEUE,
      useFactory: (redisConnection: Redis) => {
        return new Queue(ALERT_EVALUATION_QUEUE, {
          connection: redisConnection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        });
      },
      inject: [REDIS_CONNECTION],
    },
    {
      provide: NOTIFICATION_BULL_QUEUE,
      useFactory: (redisConnection: Redis) => {
        return new Queue(NOTIFICATION_QUEUE, {
          connection: redisConnection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        });
      },
      inject: [REDIS_CONNECTION],
    },
    {
      provide: LOAD_TEST_BULL_QUEUE,
      useFactory: (redisConnection: Redis) => {
        return new Queue(LOAD_TEST_QUEUE, {
          connection: redisConnection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        });
      },
      inject: [REDIS_CONNECTION],
    },
  ],
  exports: [
    REDIS_CONNECTION,
    MONITOR_BULL_QUEUE,
    ALERT_BULL_QUEUE,
    NOTIFICATION_BULL_QUEUE,
    LOAD_TEST_BULL_QUEUE,
  ],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(MONITOR_BULL_QUEUE) private readonly monitorQueue: Queue,
    @Inject(ALERT_BULL_QUEUE) private readonly alertQueue: Queue,
    @Inject(NOTIFICATION_BULL_QUEUE) private readonly notificationQueue: Queue,
    @Inject(LOAD_TEST_BULL_QUEUE) private readonly loadTestQueue: Queue,
  ) {}

  async onModuleDestroy() {
    await this.monitorQueue.close();
    await this.alertQueue.close();
    await this.notificationQueue.close();
    await this.loadTestQueue.close();
    this.redis.disconnect();
  }
}

