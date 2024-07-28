import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PanelService } from './panel.service';
import { PanelController } from './panel.controller';

@Module({
  providers: [PrismaService, PanelService],
  controllers: [PanelController],
  exports: [PanelService],
})
export class PanelModule {}
