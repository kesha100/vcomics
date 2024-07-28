import { Module } from '@nestjs/common';
import { ComicsService } from './comics.service';
import { ComicsController } from './comics.controller';
import { BullModule } from '@nestjs/bullmq';
import { ComicsConsumer } from './comics.worker';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { PrismaModule } from '../../prisma/prisma.module' 
import { PanelService } from 'src/panel/panel.service';
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'comics-generation',
    }),
    PrismaModule, 
    BullBoardModule.forFeature({
      name: 'comics-generation',
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [ComicsController],
  providers: [ComicsService, ComicsConsumer, PanelService],

})
export class ComicsModule {}
