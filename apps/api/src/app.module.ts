import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ComicsModule } from './comics/comics.module';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './core/env-validation-schema';
import { MulterModule } from '@nestjs/platform-express';
import { MulterConfigService } from './multer/multer-config.service';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { UploadthingModule } from './uploadthing/uploadthing.module';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from 'prisma/prisma.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    MulterModule.registerAsync({
      useClass: MulterConfigService,
    }),
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    ComicsModule,
    UploadthingModule,
    PrismaModule
  ]
})
export class AppModule {}
