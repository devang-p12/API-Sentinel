import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  ContactPointType,
  NotificationDeliveryStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretEncryptionService } from '../services/secret-encryption.service';
import { EmailNotificationChannel } from '../channels/email-notification.channel';
import { SlackNotificationChannel } from '../channels/slack-notification.channel';
import { WebhookNotificationChannel } from '../channels/webhook-notification.channel';
import { WebhookSecurityService } from '../services/webhook-security.service';
import {
  NOTIFICATION_QUEUE,
  REDIS_CONNECTION,
  NOTIFICATION_BULL_QUEUE,
} from '../../queue/queue.constants';

const RETRY_DELAYS_SECONDS = [30, 120, 600]; // 30s, 2m, 10m (Section 14)
const MAX_ATTEMPTS = 4;

@Injectable()
export class NotificationDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryWorker.name);
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: SecretEncryptionService,
    private readonly securityService: WebhookSecurityService,
    private readonly emailChannel: EmailNotificationChannel,
    private readonly slackChannel: SlackNotificationChannel,
    private readonly webhookChannel: WebhookNotificationChannel,
    @Inject(REDIS_CONNECTION) private readonly redisConnection: Redis,
    @Inject(NOTIFICATION_BULL_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      NOTIFICATION_QUEUE,
      async (job: Job<{ deliveryId: string }>) => {
        return this.processDelivery(job.data.deliveryId);
      },
      {
        connection: this.redisConnection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `[NotificationWorker] Job ${job?.id} failed unexpectedly: ${err.message}`,
        err.stack,
      );
    });

    this.logger.log(`[NotificationWorker] Initialized BullMQ worker on queue "${NOTIFICATION_QUEUE}"`);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  async processDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        contactPoint: true,
      },
    });

    if (!delivery) {
      this.logger.warn(`[NotificationWorker] Delivery ${deliveryId} not found, skipping`);
      return;
    }

    if (
      delivery.status === NotificationDeliveryStatus.SENT ||
      delivery.status === NotificationDeliveryStatus.CANCELLED
    ) {
      this.logger.debug(
        `[NotificationWorker] Delivery ${deliveryId} already in final state: ${delivery.status}`,
      );
      return;
    }

    const contactPoint = delivery.contactPoint;
    if (!contactPoint || !contactPoint.isEnabled) {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.CANCELLED,
          errorMessage: 'Contact point is disabled or missing',
        },
      });
      return;
    }

    const now = new Date();
    const attempt = delivery.attemptCount + 1;

    // Transition to SENDING
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.SENDING,
        lastAttemptAt: now,
        attemptCount: attempt,
      },
    });

    // Decrypt configuration
    const decryptedConfig = this.encryptionService.decryptConfig(
      contactPoint.configuration as Record<string, any>,
    );

    const payload = (delivery.payload || {}) as any;

    let result;
    try {
      if (contactPoint.type === ContactPointType.EMAIL) {
        result = await this.emailChannel.send(decryptedConfig, payload);
      } else if (contactPoint.type === ContactPointType.SLACK) {
        result = await this.slackChannel.send(decryptedConfig, payload);
      } else if (contactPoint.type === ContactPointType.WEBHOOK) {
        result = await this.webhookChannel.send(decryptedConfig, payload);
      } else {
        result = {
          success: false,
          statusMessage: `Unsupported channel type: ${contactPoint.type}`,
          retryable: false,
        };
      }
    } catch (err: any) {
      result = {
        success: false,
        statusMessage: this.securityService.sanitizeError(err),
        retryable: true,
      };
    }

    if (result.success) {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
        },
      });
      this.logger.log(
        `[NotificationWorker] ✅ Delivery ${deliveryId} to "${contactPoint.name}" (${contactPoint.type}) succeeded on attempt ${attempt}`,
      );
      return;
    }

    // Failure handling & Retry scheduling (Section 14 & 36)
    const sanitizedMsg = this.securityService.sanitizeError(result.statusMessage);
    const canRetry = result.retryable && attempt < MAX_ATTEMPTS;

    if (canRetry) {
      const delaySec = RETRY_DELAYS_SECONDS[attempt - 1] || 600;
      const nextRetryAt = new Date(Date.now() + delaySec * 1000);

      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.PENDING,
          errorMessage: sanitizedMsg,
          nextRetryAt,
        },
      });

      // Schedule delayed BullMQ job
      await this.notificationQueue.add(
        'deliver-notification',
        { deliveryId },
        {
          delay: delaySec * 1000,
          jobId: `${deliveryId}_retry_${attempt}`,
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      this.logger.warn(
        `[NotificationWorker] ⚠️ Delivery ${deliveryId} failed on attempt ${attempt}: ${sanitizedMsg}. Scheduled retry ${attempt + 1}/${MAX_ATTEMPTS} in ${delaySec}s`,
      );
    } else {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          errorMessage: sanitizedMsg,
          nextRetryAt: null,
        },
      });

      this.logger.error(
        `[NotificationWorker] ❌ Delivery ${deliveryId} permanently FAILED after ${attempt} attempt(s): ${sanitizedMsg}`,
      );
    }
  }
}
