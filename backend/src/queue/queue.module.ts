import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { MONITOR_BULL_QUEUE, MONITOR_QUEUE, REDIS_CONNECTION } from './queue.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      useFactory: () => {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6380', 10);
        return new Redis({
          host,
          port,
          maxRetriesPerRequest: null, // Required by BullMQ
        });
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
  ],
  exports: [REDIS_CONNECTION, MONITOR_BULL_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(MONITOR_BULL_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleDestroy() {
    await this.queue.close();
    this.redis.disconnect();
  }
}
