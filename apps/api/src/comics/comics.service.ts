import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import Replicate from 'replicate';
import axios from 'axios';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  async createComic(userPrompt: string, base64Image: string): Promise<any> {
    const jobId = uuidv4();
    await this.comicsQueue.add('comics-generation', {
      jobId,
      prompt: userPrompt,
      image: base64Image, // Make sure this is being passed
    });
    return { jobId, status: 'queued' };
  }

  private validateBase64Image(base64Image: string | undefined): string {
    if (!base64Image) {
      throw new Error('Base64 image data is undefined or empty');
    }

    // Remove any whitespace or newlines
    let cleanedBase64 = base64Image.replace(/\s/g, '');

    // Check if the string already has the data URI prefix
    if (!cleanedBase64.startsWith('data:image/')) {
      cleanedBase64 = `data:image/png;base64,${cleanedBase64}`;
    }

    // Extract the base64 part (after the comma)
    const base64Data = cleanedBase64.split(',')[1];

    // Check minimum and maximum length
    if (base64Data.length < 100) {
      throw new Error('Base64 image data is too short');
    }

    const maxSizeInBytes = 10 * 1024 * 1024; // 10 MB
    if (base64Data.length * 0.75 > maxSizeInBytes) {
      throw new Error('Base64 image data exceeds maximum allowed size');
    }

    // Basic character set validation
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      throw new Error('Invalid base64 image data format');
    }

    console.log('Base64 image prefix:', cleanedBase64.substring(0, 30));

    return cleanedBase64;
  }

  async describeImage(base64Image: string): Promise<any> {
    const validatedBase64 = this.validateBase64Image(base64Image);
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the best image describer. Describe the following image. We will create a beautiful art based on the image content and people 
            
            `,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: validatedBase64,
              },
            },
          ],
        },
      ],
    });
    return response.choices[0].message.content;
  }

  async generateScenario(imageDescription: string, prompt: string) {
    const style = 'american modern'
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
          "text" напиши на русском, но description оставь на английском`,
        },
      ],
      response_format: {
        type: 'json_object',
      },
    });
    return response.choices[0].message.content;
  }

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
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(imageResponse.data);

      const fileExtension = 'webp';
      const fileName = `panel-${panelNumber}-${Date.now()}.${fileExtension}`;

      const { error } = await this.supabase.storage
        .from('vcomics')
        .upload(fileName, imageBuffer, {
          contentType: 'image/webp',
        });

      if (error) {
        throw new Error(`Failed to upload image to Supabase: ${error.message}`);
      }

      const { data } = this.supabase.storage
        .from('vcomics')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error in generateImageUsingDalle:', error);
      throw error;
    }
  }
  async generateImageUsingStability(
    imageDescription: string,
    panelScenario: string,
    panelNumber: number,
  ): Promise<string> {
    const prompt = `${imageDescription}\n${panelScenario} in american modern comics style`;
    const response = await axios.postForm(
      `https://api.stability.ai/v2beta/stable-image/generate/core`,
      axios.toFormData(
        {
          prompt: prompt,
          output_format: 'webp',
        },
        new FormData(),
      ),
      {
        validateStatus: undefined,
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_AI_API_KEY}`,
          Accept: 'image/*',
        },
      },
    );

    const fileExtension = 'webp';
    const fileName = `panel-${panelNumber}-${Date.now()}.${fileExtension}`;

    const { error } = await this.supabase.storage
      .from('vcomics')
      .upload(fileName, Buffer.from(response.data), {
        contentType: 'image/webp',
      });

    if (error) {
      throw new Error(`Failed to upload image to Supabase: ${error.message}`);
    }

    const { data } = this.supabase.storage
      .from('vcomics')
      .getPublicUrl(fileName);
    return data.publicUrl;
  }

  // async generatePanelUsingReplicate(
  //   panelDescription: string,
  //   panelText: string[],
  //   base64Image: string,
  //   panelNumber: number,
  // ): Promise<string> {
  //   try {
  //     const input = {
  //       image: base64Image,
  //       description: panelDescription,
  //       texts: panelText.join('\n'),
  //     };

  //     const output = await this.replicate.run(
  //       "bytedance/sdxl-lightning-4step:5f24084160c9089501c1b3545d9be3c27883ae2239b6f412990e82d4a6210f8f",
  //       { input }
  //     );

  //     if (!output || !output[0]) {
  //       throw new Error('Failed to generate image using Replicate');
  //     }

  //     const imageUrl = output[0];
  //     const uniqueId = uuidv4();
  //     const fileName = `panel-${panelNumber}-${uniqueId}.webp`;

  //     // Download the image from the Replicate URL
  //     const imageResponse = await fetch(imageUrl);
  //     const imageBuffer = await imageResponse.arrayBuffer();

  //     // Upload the image to Supabase
  //     const { error } = await this.supabase.storage
  //       .from('vcomics')
  //       .upload(fileName, imageBuffer, {
  //         contentType: 'image/webp',
  //         upsert: false,
  //       });

  //     if (error) {
  //       throw new Error(`Failed to upload image to Supabase: ${error.message}`);
  //     }

  //     const { data } = this.supabase.storage
  //       .from('vcomics')
  //       .getPublicUrl(fileName);

  //     return data.publicUrl;
  //   } catch (error) {
  //     console.error('Error in generatePanelUsingReplicate:', error);
  //     throw error;
  //   }
  // }
  async savePanelData(panelImageUrl: string, panelText: string) {
    return this.prisma.panel.create({
      data: {
        image_url: panelImageUrl,
        text: panelText,
      },
    });
  }
  async createComicFromImage(
    base64Image: string,
    userPrompt: string,
  ): Promise<any> {
    if (!base64Image) {
      throw new Error('Base64 image data is required');
    }
    console.log('Received base64 image length:', base64Image.length);

    try {
      const validatedBase64 = this.validateBase64Image(base64Image);
      console.log('Validated base64 image length:', validatedBase64.length);

      const imageDescription = await this.describeImage(validatedBase64);
      console.log('Image description:', imageDescription);

      const scenarioDescription = await this.generateScenario(
        imageDescription,
        userPrompt,
      );
      console.log(
        'Scenario description:',
        JSON.stringify(scenarioDescription, null, 2),
      );

      // Parse the scenario description
      const scenarioObject = JSON.parse(scenarioDescription) as {
        panels: Panel[];
      };

      const jobId = uuidv4();
      const panelImageUrls: string[] = [];

      for (let i = 0; i < 12; i++) {
        const panel = scenarioObject.panels[i] || { description: '', text: [] };
        console.log(
          `Processing panel ${i + 1}:`,
          JSON.stringify(panel, null, 2),
        );

        // Generate the image for the panel using Stability AI
        const panelImageUrl = await this.generateImageUsingStability(
          imageDescription,
          `${panel.description} in American modern comics style`,
          i + 1,
        );
        panelImageUrls.push(panelImageUrl);
        await this.savePanelData(panelImageUrl, panel.text.join(' '));
        await this.comicsQueue.add('generatePanel', {
          jobId,
          panelNumber: i + 1,
          panelDescription: `${panel.description} in American modern comics style`,
          panelText: panel.text,
          panelImageUrl,
          originalImage: validatedBase64,
        });
      }

      return { jobId, status: 'queued', panelImageUrls };
    } catch (error) {
      console.error('Error in createComicFromImage:', error);
      throw error;
    }
  }
}
