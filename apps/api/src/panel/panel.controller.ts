import { Controller, Post, Body, Param } from '@nestjs/common';
import { PanelService } from './panel.service';

@Controller('panel')
export class PanelController {
  constructor(private readonly panelService: PanelService) {}

  @Post('add-text')
  async addTextToImage(
    @Body('imageUrl') imageUrl: string,
    @Body('outputImagePath') outputImagePath: string,
    @Body('text') text: string[],
  ): Promise<void> {
    await this.panelService.addTextToImage(text, imageUrl, outputImagePath);
  }
}
