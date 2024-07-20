import { Module } from '@nestjs/common';
import { ComicsService } from './comics.service';
import { ComicsController } from './comics.controller';
import { BullModule } from '@nestjs/bullmq';
import { ComicsConsumer } from './comics.worker';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'comics-generation',
    }),
    BullBoardModule.forFeature({
      name: 'comics-generation',
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [ComicsController],
  providers: [ComicsService, ComicsConsumer],
})
export class ComicsModule {}
