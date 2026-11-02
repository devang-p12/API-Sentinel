import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dns from 'node:dns';

// Ensure IPv4 DNS resolution is prioritized across cloud containers (e.g. Render)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported in runtime
}

async function bootstrap() {
  const logger = new Logger('SentinelBootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api/v1', {
    exclude: ['metrics'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`API Sentinel Backend running at http://0.0.0.0:${port}/api/v1`);
}

bootstrap();
