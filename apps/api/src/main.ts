import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as requestIp from 'request-ip';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(requestIp.mw());
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: 'https://vcomics.vercel.app', // Your frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const port = configService.get('PORT') || 3000;
  await app.listen(port);
}

bootstrap();