import { Global, Module } from '@nestjs/common';
import { SecretEncryptionService } from './services/secret-encryption.service';
import { WebhookSecurityService } from './services/webhook-security.service';
import { EmailNotificationChannel } from './channels/email-notification.channel';
import { EmailProviderService } from './channels/email-provider.service';
import { SlackNotificationChannel } from './channels/slack-notification.channel';
import { WebhookNotificationChannel } from './channels/webhook-notification.channel';
import { ContactPointsService } from './services/contact-points.service';
import { NotificationPoliciesService } from './services/notification-policies.service';
import { NotificationSilencesService } from './services/notification-silences.service';
import { NotificationRoutingService } from './services/notification-routing.service';
import { NotificationDeliveryWorker } from './workers/notification-delivery.worker';
import { ContactPointsController } from './controllers/contact-points.controller';
import { NotificationPoliciesController } from './controllers/notification-policies.controller';
import { NotificationDeliveriesController } from './controllers/notification-deliveries.controller';
import { NotificationSilencesController } from './controllers/notification-silences.controller';

@Global()
@Module({
  controllers: [
    ContactPointsController,
    NotificationPoliciesController,
    NotificationDeliveriesController,
    NotificationSilencesController,
  ],
  providers: [
    SecretEncryptionService,
    WebhookSecurityService,
    EmailProviderService,
    EmailNotificationChannel,
    SlackNotificationChannel,
    WebhookNotificationChannel,
    ContactPointsService,
    NotificationPoliciesService,
    NotificationSilencesService,
    NotificationRoutingService,
    NotificationDeliveryWorker,
  ],
  exports: [
    NotificationRoutingService,
    ContactPointsService,
    NotificationPoliciesService,
    NotificationSilencesService,
    EmailNotificationChannel,
    EmailProviderService,
  ],
})
export class NotificationsModule {}
