import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

@Injectable()
export class ComicsService {
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private readonly supabase: SupabaseClient<any, 'public', any> = createClient(
    process.env.SUPABASE_API_URL,
    process.env.SUPABASE_API_KEY,
  );
  constructor(@InjectQueue('comics-generation') private comicsQueue: Queue) {}

  async createComic(
    panelScenarioDescription: string,
    panelNumber: number,
  ): Promise<any> {
    const jobId = uuidv4();
    await this.comicsQueue.add('panels', {
      jobId,
      panelScenarioDescription,
      panelNumber,
    });
    return { jobId, status: 'queued' };
  }

  async getJobStatus(jobId: string): Promise<string> {
    const job = await this.comicsQueue.getJob(jobId);
    if (job) {
      return job.progress as unknown as string;
    } else {
      throw new Error('Job not found');
    }
  }

  async describeImage(base64Image: string): Promise<any> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the best image describer. Describe the following image. We will create a beautiful art based on the image content and people 
                Please answer the following questions:\n" 
                       "0. What is this or who is this?\n" 
                       "1. Is this a girl or boy?\n" 
                       "2. What is this person wearing?\n" 
                       "3. What is this person doing and what is the background?\n" 
                       "4. What is the person's expression and mood?\n" 
                       "7. What is the person's skin color?"
                `,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });
    return response.choices[0].message.content;
  }

  async generateScenario(imageDescription: string, prompt: string) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
                You are a cartoon creator. 
    
                You will be given a short scenario, which you must split into 12 parts. 
                Each part will be a different cartoon panel. 
                For each cartoon panel, you will write a description of it with: 
                - the characters in the panel, described precisely and consistently in each panel 
                - the background of the panel 
                - the same characters appearing throughout all panels without changing their descriptions 
                - maintaining the same style for all panels 
            
                The description should consist only of words or groups of words delimited by commas, no sentences. 
                Always use the characters' descriptions instead of their names in the cartoon panel descriptions. 
                Do not repeat the same description for different panels. 
            
                You will also write the text of the panel. 
                The text should not be more than 2 short sentences. 
                Each sentence should start with the character's name. 
            
                Example input: 
                Characters: Adrien is a guy with blond hair wearing glasses. Vincent is a guy with black hair wearing a hat. 
                Adrien and Vincent want to start a new product, and they create it in one night before presenting it to the board. 
            
                Example output: 
            
                # Panel 1 
                description: a guy with blond hair wearing glasses, a guy with black hair wearing a hat, sitting at the office, with computers 
                text: 
              
                Vincent: I think Generative AI is the future of the company. 
                Adrien: Let's create a new product with it. 
            
                # Panel 2 
                description: a guy with blond hair wearing glasses, a guy with black hair wearing a hat, working hard, with papers and notes scattered around 
                text: 
              
                Adrien: We need to finish this by morning. 
                Vincent: Keep going, we can do it! 
            
                # Panel 3 
                description: a guy with blond hair wearing glasses, a guy with black hair wearing a hat, presenting their product, in a conference room, with a projector 
                text: 
              
                Vincent: Here's our new product! 
                Adrien: We believe it will revolutionize the industry. 
            
                # end 
            
                Short Scenario: 
                {scenario} 
            
                Split the scenario into 12 parts, ensuring the characters remain consistent in description throughout all panels.
                You should return your answer in JSON array of comic panels. For example, consider this JSON array of comic panels: 
                
                {
                  "panels": [
                    {
                      "panel": 1,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, standing in a toy store, cheerful background with shelves of toys",
                      "text": [
                        "Alibek: Look at all these toys!",
                        "Alibek: I could spend all day here!"
                      ]
                    },
                    {
                      "panel": 2,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, crouching down to grab a plush toy, colorful plush toys around him",
                      "text": [
                        "Alibek: This plush toy looks amazing!",
                        "Alibek: I have to take it home!"
                      ]
                    },
                    {
                      "panel": 3,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, holding the plush toy close, smiling brightly, colorful store atmosphere",
                      "text": [
                        "Alibek: You're coming with me, little buddy!",
                        "Alibek: We're going to have so much fun!"
                      ]
                    },
                    {
                      "panel": 4,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, walking out of the store with the plush toy, sunny day outside, people in the background",
                      "text": [
                        "Alibek: The sunshine feels great!",
                        "Alibek: Let’s find somewhere to play!"
                      ]
                    },
                    {
                      "panel": 5,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, sitting on a park bench with the plush toy, green park setting",
                      "text": [
                        "Alibek: This place is perfect for us!",
                        "Alibek: Let's enjoy the scenery together!"
                      ]
                    },
                    {
                      "panel": 6,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, throwing the plush toy in the air, laughter in the park, other kids playing nearby",
                      "text": ["Alibek: Wheee! You’re flying!", "Alibek: Catch you in a bit!"]
                    },
                    {
                      "panel": 7,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, sitting cross-legged on the ground with plush toy, grassy area, playful atmosphere",
                      "text": [
                        "Alibek: Time for some fun stories!",
                        "Alibek: What shall we imagine today?"
                      ]
                    },
                    {
                      "panel": 8,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, pretending to have a tea party with the plush toy, picnic blanket spread, joyful setting",
                      "text": [
                        "Alibek: Welcome to the tea party, my friend!",
                        "Alibek: You're the guest of honor!"
                      ]
                    },
                    {
                      "panel": 9,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, hugging the plush toy tightly, smiling widely, bright park background",
                      "text": [
                        "Alibek: You're the best companion!",
                        "Alibek: I’m so glad I found you!"
                      ]
                    },
                    {
                      "panel": 10,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, lying on the grass, plush toy resting on his chest, peaceful atmosphere",
                      "text": [
                        "Alibek: Let’s take a rest now.",
                        "Alibek: Dreaming about our next adventure!"
                      ]
                    },
                    {
                      "panel": 11,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, waving goodbye to the park as he walks home holding the plush toy, setting sun in the background",
                      "text": [
                        "Alibek: What a wonderful day we had!",
                        "Alibek: Can't wait for tomorrow!"
                      ]
                    },
                    {
                      "panel": 12,
                      "description": "a guy with light skin wearing a black t-shirt with 'factorial' in colorful print, wearing sunglasses, in his cozy bedroom, placing the plush toy on a shelf, warm lighting from a bedside lamp",
                      "text": [
                        "Alibek: Sleep well, buddy!",
                        "Alibek: Tomorrow will be another fun day!"
                      ]
                    }
                  ]
                }
          `,
        },
        {
          role: 'user',
          content: `Here is a user prompt: ${prompt}\n\n And here is the image description${imageDescription}`,
        },
      ],
      response_format: {
        type: 'json_object',
      },
    });
    return response.choices[0].message.content;
  }

  async generateImageUsingStability(
    panelScenario: string,
    panelNumber: number,
  ): Promise<string> {
    const response = await axios.postForm(
      `https://api.stability.ai/v2beta/stable-image/generate/core`,
      axios.toFormData(
        {
          prompt: panelScenario,
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
      .from('panels')
      .upload(fileName, Buffer.from(response.data), {
        contentType: 'image/webp',
      });

    if (error) {
      throw new Error(`Failed to upload image to Supabase: ${error.message}`);
    }

    const { data } = this.supabase.storage
      .from('panels')
      .getPublicUrl(fileName);
    return data.publicUrl;
  }
}
