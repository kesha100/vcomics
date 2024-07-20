### Overview

VComics is an AI-powered comic generator that creates a 12-panel comic based on user prompts and images of living creatures (humans or pets). The system utilizes LLMs and the Stability AI API, with a NestJS backend, Redis for job queuing, and Node.js workers to handle image processing and comic generation.

### System Components

- **Supabase/S3**: For storing uploaded images.
- **Stability AI API**: For generating comic panels from descriptions.
- **Large Language Models (LLMs)**: For image description and scenario generation.
- **NestJS Backend**: Main backend server to process requests, manage job queues, and interact with the Node.js workers.
- **Redis Job Queue**: Redis for managing job queues between NestJS and Node.js workers.
- **Node.js Workers**: Handles image uploading, processing, and interaction with AI services.

### System Workflow

1. **User Input**:

   - User submits a prompt and an image via the web interface.
   - The request is sent to the NestJS backend.

2. **Request Handling**:

   - NestJS backend enqueues the job in Redis using BullMQ.

3. **Job Processing**:

   - Node.js worker dequeues jobs from Redis.
   - Node.js worker uploads the image to Supabase/S3 and receives the image URL.
   - Node.js worker sends the prompt and image URL to the LLM for image description.

4. **Image Description**:

   - LLM generates a detailed description of the image based on the provided system prompt and user prompt.
   - Node.js worker sends the image description and comic prompt to the LLM to create a 12-panel scenario.

5. **Comic Generation**:

   - Node.js worker sends requests to Stability AI to generate images for each of the 12 panels based on the LLM-generated descriptions.
   - Stability AI returns the generated images.
   - Node.js worker merges the 12 images into a single comic strip or video.

6. **Output Delivery**:

   - The final comic is sent back to the NestJS backend.
   - NestJS backend returns the comic to the frontend for user download or viewing.

7. **Job Status Checking**:
   - Users can check the status of their job by making periodic requests to the job status endpoint.

### Detailed Component Design

1. **NestJS Backend (`comics-service.ts`)**:

   ```typescript
   import { Injectable } from '@nestjs/common';
   import { InjectQueue } from '@nestjs/bullmq';
   import { Queue, Job } from 'bullmq';
   import { v4 as uuidv4 } from 'uuid';

   @Injectable()
   export class ComicsService {
     constructor(@InjectQueue('comics') private readonly comicsQueue: Queue) {}

     async createComic(
       prompt: string,
       image: Express.Multer.File
     ): Promise<any> {
       const jobId = uuidv4();
       const job = await this.comicsQueue.add('create-comic', {
         jobId,
         prompt,
         image,
       });
       return { jobId, status: 'queued' };
     }

     async getJobStatus(jobId: string): Promise<string> {
       const job = await this.comicsQueue.getJob(jobId);
       if (job) {
         return job.progress() as unknown as string;
       } else {
         throw new Error('Job not found');
       }
     }

     async generateComicPanel(
       panelScenario: string,
       job: Job
     ): Promise<string> {
       // Call Stability AI to generate an image for the given panel scenario
       const generatedImageUrl = await callStabilityAIApi(panelScenario);
       return generatedImageUrl;
     }

     async generateComicPanels(
       scenario: string[],
       job: Job
     ): Promise<string[]> {
       const totalPanels = scenario.length;
       let completedPanels = 0;

       const panelPromises = scenario.map(async (panelScenario) => {
         const panel = await this.generateComicPanel(panelScenario, job);
         completedPanels += 1;
         const progress = Math.floor((completedPanels / totalPanels) * 100);
         await job.updateProgress(progress);
         return panel;
       });

       const panelResults = await Promise.all(panelPromises);
       return panelResults;
     }
   }
   ```

2. **NestJS Controller**:

   ```typescript
   import {
     Controller,
     Post,
     UploadedFile,
     UseInterceptors,
     Body,
     Get,
     Param,
   } from '@nestjs/common';
   import { FileInterceptor } from '@nestjs/platform-express';
   import { ComicsService } from './comics-service';

   @Controller('comics')
   export class ComicsController {
     constructor(private readonly comicsService: ComicsService) {}

     @Post('create')
     @UseInterceptors(FileInterceptor('image'))
     async createComic(
       @Body('prompt') prompt: string,
       @UploadedFile() image: Express.Multer.File
     ) {
       return this.comicsService.createComic(prompt, image);
     }

     @Get('status/:jobId')
     async getJobStatus(@Param('jobId') jobId: string) {
       return this.comicsService.getJobStatus(jobId);
     }
   }
   ```

3. **Node.js Worker (`comics-worker.ts`)**:

   ```javascript
   const { Worker, Queue, QueueScheduler } = require('bullmq');
   const {
     uploadImage,
     describeImage,
     generateScenario,
     mergePanels,
   } = require('./services');

   const redisOptions = { host: 'localhost', port: 6379 };

   const comicsQueue = new Queue('comics', { connection: redisOptions });
   new QueueScheduler('comics', { connection: redisOptions });

   const worker = new Worker(
     'comics',
     async (job) => {
       const { jobId, prompt, image } = job.data;

       await job.updateProgress(10); // 10% progress - Image Uploading
       const imageUrl = await uploadImage(image);
       await job.updateProgress(20); // 20% progress - Image Uploaded

       const imageDescription = await describeImage(prompt, imageUrl);
       await job.updateProgress(30); // 30% progress - Image Described

       const scenario = await generateScenario(prompt, imageDescription);
       await job.updateProgress(40); // 40% progress - Scenario Created

       const panelResults = await generateComicPanels(scenario, job);
       await job.updateProgress(90); // 90% progress - Panels Generated

       const comic = await mergePanels(panelResults);
       await job.updateProgress(100); // 100% progress - Comic Created
     },
     { connection: redisOptions }
   );

   worker.on('completed', (job) => {
     console.log(`Job ${job.id} completed! Result:`, job.returnvalue);
   });

   worker.on('failed', (job, err) => {
     console.error(`Job ${job.id} failed:`, err);
   });
   ```

4. **Services**:
   - **uploadImage**: Uploads image to Supabase/S3 and returns the URL.
   - **describeImage**: Sends image URL and prompt to the LLM for description.
   - **generateScenario**: Uses LLM to create a 12-panel scenario from the prompt and image description.
   - **generateComicPanels**: Sends each panel description to Stability AI to generate images.
   - **mergePanels**: Merges the 12 images into a single comic strip or video.

### Client-Side Implementation

Implement the client-side polling to check job status using `@tanstack/react-query` for state management and short-polling:

1. **Install `@tanstack/react-query`**:

   ```sh
   npm install @tanstack/react-query
   ```

2. **Set Up React Query Client**:

   ```typescript
   import React from 'react';
   import ReactDOM from 'react-dom';
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   import App from './App';

   const queryClient = new QueryClient();

   ReactDOM.render(
     <QueryClientProvider client={queryClient}>
       <App />
     </QueryClientProvider>,
     document.getElementById('root')
   );
   ```

3. **Create a Custom Hook for Polling**:

   ```javascript
   import { useQuery } from '@tanstack/react-query';

   const fetchJobStatus = async (jobId) => {
     const response = await fetch(`/comics/status/${jobId}`);
     if (!response.ok) {
       throw new Error('Network response was not ok');
     }
     return response.json();
   };

   const useJobStatus = (jobId) => {
     return useQuery(['jobStatus', jobId], () => fetchJobStatus(jobId), {
       refetchInterval: 3000, // Refetch every 3 seconds
     });
   };

   export default useJobStatus;
   ```

4. **Use the Custom Hook in a Component**:

   ```javascript
   import React from 'react';
   import useJobStatus from './useJobStatus';

   const JobStatus = ({ jobId }) => {
     const { data, error, isLoading } = useJobStatus(jobId);

     if (isLoading) return <div>Loading...</div>;
     if (error) return <div>Error fetching job status</div>;

     return (
       <div>
         <h2>Job Status</h2>
         <p>{data}</p>
       </div>
     );
   };

   export default JobStatus;
   ```

5. **Use the Component in Your App**:

   ```javascript
   import React, { useState } from 'react';
   import JobStatus from './JobStatus';

   const App = () => {
     const [jobId, setJobId] = useState('your-job-id');

     return (
       <div>
         <h1>VComics Job Status</h1>
         <JobStatus jobId={jobId} />
       </div>
     );
   };

   export default App;
   ```
