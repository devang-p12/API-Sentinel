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
        if (process.env.REDIS_URL) {
          client = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null, // Required by BullMQ
            enableReadyCheck: false,
          });
        } else {
          const host = process.env.REDIS_HOST || 'localhost';
          const port = parseInt(process.env.REDIS_PORT || '6380', 10);
          client = new Redis({
            host,
            port,
            maxRetriesPerRequest: null, // Required by BullMQ
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

