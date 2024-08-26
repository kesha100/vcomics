// import { Injectable } from '@nestjs/common';
// import { createRouteHandler } from "uploadthing/express";
// import { uploadRouter } from "./uploadthing.config";
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class UploadthingService {
//   constructor(private configService: ConfigService) {}

//   getRouteHandler() {
//     return createRouteHandler({
//       router: uploadRouter,
//       config: {
//         uploadthingId: this.configService.get<string>('UPLOADTHING_APP_ID'),
//         uploadthingSecret: this.configService.get<string>('UPLOADTHING_SECRET'),
//       },
//     });
//   }
// }