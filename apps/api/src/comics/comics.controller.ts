import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ComicsService } from './comics.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BullBoardInstance, InjectBullBoard } from '@bull-board/nestjs';

@Controller('comics')
export class ComicsController {
  constructor(
    private readonly comicsService: ComicsService,
    @InjectBullBoard() private readonly boardInstance: BullBoardInstance,
  ) {}

  @Post('generate-scenario')
  @UseInterceptors(FileInterceptor('image'))
  async generateScenario(
    @Body('prompt') prompt: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return new BadRequestException('Image file is required');
    }

    const base64Image = file.buffer.toString('base64');
    const imageDescription =
      await this.comicsService.describeImage(base64Image);
    console.log(imageDescription);
    const scenarioText = await this.comicsService.generateScenario(
      imageDescription,
      prompt,
    );
    const scenarioJson = JSON.parse(scenarioText);
    console.log(scenarioJson);

    // for (const panel of scenarioJson.panels) {
    //   const job = await this.comicsService.createComic(
    //     panel.description,
    //     panel.panel,
    //   );
    //   console.log(job);
    // }
    const job = await this.comicsService.createComic(
      scenarioJson.panels[0].description,
      scenarioJson.panels[0].panel,
    );
    console.log(job);

    return scenarioJson;
  }

  @Post('generate-panel')
  async generatePanel(@Body('prompt') prompt: string) {
    return await this.comicsService.generateImageUsingStability(prompt, 1);
  }
}
