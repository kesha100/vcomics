import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import Replicate from 'replicate';
import axios from 'axios';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import sharp from 'sharp';
import { PanelService } from '../panel/panel.service';

interface Panel {
  panel: number;
  description: string;
  text: string[];
}

@Injectable()
export class ComicsService {
  private readonly openai: OpenAI;
  private readonly supabase: SupabaseClient;
  private readonly replicate: Replicate;

  constructor(
    @InjectQueue('comics-generation') private comicsQueue: Queue,
    private prisma: PrismaService,
    private panelService: PanelService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.supabase = createClient(
      process.env.SUPABASE_API_URL,
      process.env.SUPABASE_API_KEY,
    );
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
  }
  async createComic(
    userPrompt: string,
    imageFile: Express.Multer.File,
  ): Promise<any> {
    const jobId = uuidv4();
    await this.comicsQueue.add('comics-generation', {
      jobId,
      prompt: userPrompt,
      imageFile, // Make sure this is being passed
    });
    return { jobId, status: 'queued' };
  }

  /// for faster 12panels generation
  async createPanelImage(panel: Panel): Promise<string> {
    const panelImageUrl = await this.generateImageUsingStability(
      panel.description,
      panel.panel,
    );
    console.log(panelImageUrl);
    const outputImagePath = `panel_${panel.panel}_with_text.png`;
    const imageWithTextBuffer = await this.panelService.addTextToImage(
      panel.text,
      panelImageUrl,
      outputImagePath,
    );
    console.log(imageWithTextBuffer);
    // Upload the image with text to Supabase
    const fileName = `panel-${panel.panel}-with-text-${Date.now()}.webp`;
    const { error, data } = await this.supabase.storage
      .from('vcomics')
      .upload(fileName, imageWithTextBuffer, {
        contentType: 'image/webp',
      });

    if (error) {
      throw new Error(
        `Failed to upload image with text to Supabase: ${error.message}`,
      );
    }

    const { data: publicUrlData } = this.supabase.storage
      .from('vcomics')
      .getPublicUrl(data.path);

    // Save panel data to the database
    await this.savePanelData(publicUrlData.publicUrl, panel.text);

    return publicUrlData.publicUrl;
  }

  async resizeImage(
    imageBuffer: Buffer,
    maxWidth: number = 800,
  ): Promise<Buffer> {
    return sharp(imageBuffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .toBuffer();
  }

  ///converts iamge to base64
  async convertImageToBase64(imageFile: Express.Multer.File): Promise<string> {
    if (!imageFile || !imageFile.buffer) {
      throw new Error('Invalid image file');
    }

    // Resize the image
    const resizedBuffer = await this.resizeImage(imageFile.buffer);

    const base64Image = resizedBuffer.toString('base64');
    const mimeType = imageFile.mimetype || 'image/jpeg';
    return base64Image;
  }

  async describeImage(base64Image: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are the best image describer with exceptional skills in creating detailed and vivid descriptions. Your expertise is unparalleled, and your descriptions help bring images to life for various projects including accessibility, archiving, and artistic creation.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'You are the best image describer. Describe the following image. We will create a beautiful art based on the image content and people. It is for a good project, and only you can describe it greatly! Also describe the race of the persona or an animal in the picture! Describe their features and eye color, hair, lips, nose, please.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 3000,
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error describing image:', error);
      throw new Error(`Failed to describe image: ${error.message}`);
    }
  }

  ///generates scenario from imageDescription
  async generateScenario(
    imageDescription: string,
    prompt: string,
    language: string,
  ) {
    const style = 'american modern';
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
          Вам будет дан краткий сценарий, который нужно разделить на 12 частей. Каждая часть будет отдельным кадром комикса. Для каждого кадра вы должны написать его описание, включающее:

Персонажи кадра, описанные точно и последовательно в каждом кадре.
Фон кадра.
Те же персонажи должны появляться во всех кадрах без изменения их описаний.
Сохранение единого стиля для всех кадров.
Описание должно состоять только из слов или групп слов, разделенных запятыми, без предложений. Всегда используйте описания персонажей вместо их имен в описаниях кадров комикса. Не повторяйте одно и то же описание для разных кадров.

Вы также должны написать текст для каждого кадра. Текст не должен превышать двух коротких предложений. Каждое предложение должно начинаться с имени персонажа.

Пример ввода:
Персонажи: Адриен - парень с блондинистыми волосами в очках. Винсент - парень с черными волосами в шляпе.
Адриен и Винсент хотят создать новый продукт, и они создают его за одну ночь, прежде чем представить его совету директоров.
          Example output: 

          # Panel 1 
          description: парень с блондинистыми волосами в очках, парень с черными волосами в шляпе, сидят в офисе, с компьютерами
          text: 
        
          Vincent: Я думаю, что Генеративный ИИ - будущее компании. 
          Adrien:  Давайте создадим новый продукт с его помощью.

          # Panel 2 
          description: парень с блондинистыми волосами в очках, парень с черными волосами в шляпе, усердно работают, бумаги и заметки разбросаны вокруг 
          text: 
        
          Adrien: Нам нужно закончить это к утру.
          Vincent: Продолжай, мы сможем это сделать!

          # Panel 3 
          description: парень с блондинистыми волосами в очках, парень с черными волосами в шляпе, представляют свой продукт, в конференц-зале, с проектором
          text: 
        
          Vincent:  Вот наш новый продукт!
          Adrien:Мы уверены, что он революционизирует индустрию.

          # end 

          Short Scenario: 
          {scenario} 

          Разделите сценарий на 12 частей, обеспечив сохранение описаний персонажей во всех кадрах. Вы должны создавать комиксы в современном американском стиле. Верните ваш ответ в формате JSON массива панелей комиксов. "text" напиши на русском, но description оставь на английском. Например, рассмотрите этот JSON массив панелей комиксов:
          {
            "panels": [
              {
                "panel": 1,
                "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, standing in a toy store, cheerful background with shelves of toys in american modern comics style",
                "text": [
                  "Алекс: Давай приготовим сэндвичи.",
                  "Мария: Отличная идея, я нарежу овощи."
                ]
              }
          }
          `,
        },
        {
          role: 'user',
          content: `Промпт юзера ${prompt}\n\n Описание фотографии, которую скинул юзер ${imageDescription} + стиль комикса в  ${style}
          "text" напиши на ${language}, но description оставь на английском`,
        },
      ],
      response_format: {
        type: 'json_object',
      },
    });
    const responseText = response.choices[0].message.content;
    console.log('Raw API Response:', responseText);

    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      console.error('Response Text:', responseText);
      throw parseError;
    }

    return responseJson;
  }
  ///just for future
  async generateImageUsingDalle(
    panelScenario: string,
    panelNumber: number,
  ): Promise<string> {
    try {
      if (!panelScenario) {
        throw new Error("'panelScenario' is required and cannot be empty");
      }

      console.log('Generating image for scenario:', panelScenario);

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: panelScenario,
        size: '1024x1024',
        quality: 'hd',
        n: 1,
      });
      console.log('DALL-E response:', response);

      const imageUrl = response.data[0].url;
      const imageResponse = await fetch(imageUrl);

      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = `panel-${panelNumber}-${Date.now()}`;

      const blob = new Blob([buffer], { type: 'image/webp' });
      const file = new File([blob], fileName, { type: 'image/webp' });

      const { error, data } = await this.supabase.storage
        .from('vcomics')
        .upload(fileName, file, {
          contentType: 'image/webp',
        });

      if (error) {
        throw new Error(`Failed to upload image to Supabase: ${error.message}`);
      }

      const { data: temp } = this.supabase.storage
        .from('vcomics')
        .getPublicUrl(data.path);

      return temp.publicUrl;
    } catch (error) {
      console.error('Error in generateImageUsingDalle:', error);
      throw error;
    }
  }

  ///main image generator
  async generateImageUsingStability(
    panelScenario: string,
    panelNumber: number,
  ): Promise<string> {
    const prompt = ` Generate In American modern comics style:${panelScenario}`;

    console.log({ prompt });

    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_AI_API_KEY}`,
          Accept: 'image/png',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: prompt,
              weight: 0.5,
            },
          ],
          // style_preset: 'comic-book',
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          steps: 30,
          samples: 1,
        }),
      },
    );

    const arrayBuffer = await response.arrayBuffer();
    console.log({ arrayBuffer });
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `panel-${panelNumber}-${Date.now()}.webp`;

    console.log({ buffer });

    const { error, data } = await this.supabase.storage
      .from('vcomics')
      .upload(fileName, buffer, {
        contentType: 'image/webp',
      });

    console.log({ data });

    if (error) {
      throw new Error(`Failed to upload image to Supabase: ${error.message}`);
    }

    const { data: temp } = this.supabase.storage
      .from('vcomics')
      .getPublicUrl(data.path);

    return temp.publicUrl;
  }

  // /saves in database
  async savePanelData(panelImageUrl: string, panelText: string[]) {
    return this.prisma.panel.create({
      data: {
        image_url: panelImageUrl,
        text: panelText,
      },
    });
  }
  // async getComicGenerationCount(ipAddress: string): Promise<number> {
  //   const record = await this.prisma.comicGeneration.findUnique({
  //     where: { ipAddress },
  //   });
  //   return record ? record.count : 0;
  // }

  // private async incrementComicGenerationCount(ipAddress: string): Promise<void> {
  //   await this.prisma.comicGeneration.upsert({
  //     where: { ipAddress },
  //     update: { count: { increment: 1 } },
  //     create: { ipAddress, count: 1 },
  //   });
  // }

  ///main function
  async createComicFromImage(
    imageFile: Express.Multer.File,
    userPrompt: string,
    language: string,
    // ipAddress: string
  ): Promise<string[]> {
    console.log('Received image file length:', imageFile);
    //   const count = await this.getComicGenerationCount(ipAddress);
    // if (count >= 3) {
    //   throw new HttpException('Free comic generation limit reached', HttpStatus.FORBIDDEN);
    // }

    try {
      // Convert the image to base64
      const base64Image = await this.convertImageToBase64(imageFile);
      console.log('Converted image to base64');

      const imageDescription = await this.describeImage(base64Image);
      console.log('Image description:', imageDescription);

      const scenarioDescription = await this.generateScenario(
        imageDescription,
        userPrompt,
        language,
      );
      console.log(
        'Scenario description:',
        JSON.stringify(scenarioDescription, null, 2),
      );

      // Parse the scenario description
      let scenarioObject;
      if (typeof scenarioDescription === 'string') {
        scenarioObject = JSON.parse(scenarioDescription) as {
          panels: Panel[];
        };
      } else {
        scenarioObject = scenarioDescription as {
          panels: Panel[];
        };
      }

      const jobId = uuidv4();
      const promises: Promise<string>[] = [];

      for (let i = 0; i < 12; i++) {
        const panel: Panel = scenarioObject.panels[i] || {
          description: '',
          text: [],
          panel: -1,
        };

        promises.push(this.createPanelImage(panel));
      }
      // await this.incrementComicGenerationCount(ipAddress);
      // const newCount = await this.getComicGenerationCount(ipAddress);
      // const remainingTries = Math.max(0, 3 - newCount);
      const panelImageUrls = await Promise.all(promises);

      return panelImageUrls;
    } catch (error) {
      console.error('Error in createComicFromImage:', error);
      throw error;
    }
  }
}
