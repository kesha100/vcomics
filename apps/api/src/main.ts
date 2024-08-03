import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { UploadthingService } from './uploadthing/uploadthing.service';
import * as requestIp from 'request-ip';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(requestIp.mw());
  const configService = app.get(ConfigService);
  const uploadthingService = app.get(UploadthingService);

  // app.use("/api/uploadthing", uploadthingService.getRouteHandler());
  app.enableCors({
    origin: 'https://vcomics.vercel.app/', // Replace with your Vercel app's domain
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  const port = configService.get('PORT') || 3000;
  await app.listen(port);
}
bootstrap();