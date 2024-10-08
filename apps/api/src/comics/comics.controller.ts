import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ComicsService } from './comics.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BullBoardInstance, InjectBullBoard } from '@bull-board/nestjs';
import { IpAddress } from './ip-address.decorator'; // Import the decorator

interface Panel {
  panel: number;
  description: string;
  text: string[];
}
import {  Param, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Controller('images')
export class ImagesController {
  private supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_API_URL,
      process.env.SUPABASE_API_KEY
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('imageName') imageName: string,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('Image file is required');
      }

      // Assuming your images are stored in a bucket named 'images'
      const { data, error } = await this.supabase.storage
        .from('vcomics')
        .upload(imageName, file.buffer, {
          contentType: file.mimetype,
        });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return { success: true, data };
    } catch (error) {
      throw new BadRequestException(`Error uploading image: ${error.message}`);
    }
  }
}
@Controller('comics')
export class ComicsController {
  constructor(
    private readonly comicsService: ComicsService,
    @InjectBullBoard() private readonly boardInstance: BullBoardInstance,
  ) {}

  // @Post('generate-scenario')
  // @UseInterceptors(FileInterceptor('image'))
  // async generateScenario(
  //   @Body('prompt') prompt: string,
  //   @UploadedFile() file: Express.Multer.File,
  // ) {
  //   if (!file) {
  //     throw new BadRequestException('Image file is required');
  //   }

  //   const base64Image = await this.comicsService.convertImageToBase64(file);
  //   const imageDescription =
  //     await this.comicsService.describeImage(base64Image);
  //   console.log(imageDescription);

  //   const style = 'american modern comics';
  //   const scenarioText = await this.comicsService.generateScenario(
  //     imageDescription,
  //     prompt,
  //   );
  //   const scenarioJson = JSON.parse(scenarioText);
  //   console.log(scenarioJson);

  //   return scenarioJson;
  // }

  // @Post('create-panel-image')
  // async createPanelImage(@Body('panel') panel: Panel) {
  //   const imageUrl = await this.comicsService.createPanelImage(panel);
  //   return imageUrl;
  // }

  @Post('create-comic')
  @UseInterceptors(FileInterceptor('image'))
  async createComic(
    @UploadedFile() file: Express.Multer.File,
    @Body('prompt') prompt: string,
    @Body('language') language: string,
    @IpAddress() ipAddress: string,
  ) {
    // console.log('Received file:', {
    //   originalname: file.originalname,
    //   mimetype: file.mimetype,
    //   size: file.size,
    // });

    if (file.size < 1000) {
      // Adjust this threshold as needed
      throw new BadRequestException('File size is too small');
    }

    const comicPanels = await this.comicsService.createComicFromImage(
      file,
      prompt,
      language,
    );

    return { panels: { panelImageUrls: comicPanels } };
  }
  // @Get('remaining-tries')
  // async getRemainingTries(@IpAddress() ipAddress: string): Promise<{ remainingTries: number }> {
  //   const count = await this.comicsService.getComicGenerationCount(ipAddress);
  //   const remainingTries = Math.max(0, 5 - count);
  //   return { remainingTries };
  // }
}
