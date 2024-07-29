import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ComicsModule } from './comics/comics.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envValidationSchema } from './core/env-validation-schema';
import { MulterModule } from '@nestjs/platform-express';
import { MulterConfigService } from './multer/multer-config.service';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { UploadthingModule } from './uploadthing/uploadthing.module';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from 'prisma/prisma.module';
import { PanelModule } from './panel/panel.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    MulterModule.registerAsync({
      useClass: MulterConfigService,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    ComicsModule,
    UploadthingModule,
    PrismaModule,
    PanelModule
  ]
})
export class AppModule {}