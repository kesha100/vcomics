import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { ComicsService } from './comics.service';

@Processor('comics-generation', { concurrency: 1 })
@Injectable()
export class ComicsConsumer extends WorkerHost {
  constructor(private readonly comicsService: ComicsService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    try {
      const { jobId, prompt, image } = job.data;
      await job.updateProgress(10);

      // const imageDescription = await this.comicsService.describeImage(image);
      // console.log('Image description:', imageDescription);
      // await job.updateProgress(30);

      // const scenario = await this.comicsService.generateScenario(imageDescription, prompt);
      // console.log('Generated scenario:', scenario);
      // await job.updateProgress(40);

      // const panelResults = await this.comicsService.createComicFromImage(image, prompt);
      // console.log('Panel results:', panelResults);
      await job.updateProgress(100);

      // return panelResults;

    } catch (error) {
      console.error(`Job ${job.id} - Error: ${error.message}`);
      await job.updateProgress(100);
      throw error;
    }
  }
}