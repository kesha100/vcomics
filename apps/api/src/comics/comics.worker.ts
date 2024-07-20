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
    } catch (error) {
      console.error(`Job ${job.id} - Error: ${error.message}`);
      throw error;
    }
  }
}
