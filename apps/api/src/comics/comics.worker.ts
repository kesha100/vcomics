import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ComicsService } from './comics.service';

interface Panel {
  panel: number;
  description: string;
  text: string[];
}

@Processor('comics-generation', { concurrency: 1 })
@Injectable()
export class ComicsConsumer extends WorkerHost {
  private readonly logger = new Logger(ComicsConsumer.name);

  constructor(private readonly comicsService: ComicsService) {
    super();
  }

  async process(job: Job<{ jobId: string } & Panel>): Promise<any> {
    try {
      const { jobId, description, panel, text } = job.data;

      this.logger.log(`Processing job ${jobId}`);

      await job.updateProgress(20);

      try {
        const scenario = `${description} in American modern comics style`;

        const panelImageUrl =
          await this.comicsService.generateImageUsingStability(scenario, panel);

        job.updateProgress(60);

        await this.comicsService.savePanelData(panelImageUrl, text);

        console.log('save panel data');
      } catch (error) {
        this.logger.error(`Error processing panel ${panel}: ${error.message}`);
      }

      await job.updateProgress(100);
    } catch (error) {
      this.logger.error(`Job ${job.id} - Error: ${error.message}`);
      await job.updateProgress(100);
      throw error;
    }
  }
}
