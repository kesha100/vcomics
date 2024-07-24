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
      throw new BadRequestException('Image file is required');
    }

    const base64Image = file.buffer.toString('base64');
    const imageDescription = await this.comicsService.describeImage(base64Image);
    console.log(imageDescription);
    const scenarioText = await this.comicsService.generateScenario(imageDescription, prompt);
    const scenarioJson = JSON.parse(scenarioText);
    console.log(scenarioJson);

    return scenarioJson;
  }

  // @Post('generate-panel')
  // async generatePanel(@Body('prompt') prompt: string) {
  //   return await this.comicsService.generateImageUsingStability(prompt, 1);
  // }

  @Post('create-comic')
@UseInterceptors(FileInterceptor('image'))
async createComic(@UploadedFile() file: Express.Multer.File, @Body('prompt') prompt: string) {
  if (!file || !prompt) {
    throw new BadRequestException('Image and prompt are required');
  }

  console.log('Received file:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  if (file.size < 1000) { // Adjust this threshold as needed
    throw new BadRequestException('File size is too small');
  }

  const base64Image = file.buffer.toString('base64');
  const comicPanels = await this.comicsService.createComicFromImage(base64Image, prompt);

  return { panels: comicPanels };
}
}
