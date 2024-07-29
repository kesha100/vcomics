import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { UploadthingService } from './uploadthing/uploadthing.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const configService = app.get(ConfigService);
  const uploadthingService = app.get(UploadthingService);

  // app.use("/api/uploadthing", uploadthingService.getRouteHandler());

  const port = configService.get('PORT') || 3000;
  await app.listen(port);
}
bootstrap();