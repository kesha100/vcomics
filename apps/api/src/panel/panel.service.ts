import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import sharp from 'sharp';
import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import * as path from 'path';
import axios from 'axios';

interface Panel {
  panel: number;
  description: string;
  text: string[];
}

@Injectable()
export class PanelService {
  constructor(private readonly prisma: PrismaService) {}

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
  async addTextToImage(
    text: string[],
    imageUrl: string,
    outputImagePath: string,
  ): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data, 'binary');

      console.log({ imageBuffer });
      console.log({ imageUrl });

      const pngBuffer = await sharp(imageBuffer).png().toBuffer();

      const image = await loadImage(pngBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(image, 0, 0);

      this.addComicBubbles(ctx, text, image.width, image.height);

      const buffer = canvas.toBuffer('image/png');
      const fullOutputPath = path.resolve(
        __dirname,
        '../../..',
        outputImagePath,
      );
      await sharp(buffer).toFile(fullOutputPath);

      return buffer; // Return the buffer instead of void
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to add text to image');
    }
  }

  private addComicBubbles(
    ctx: CanvasRenderingContext2D,
    texts: string[],
    width: number,
    height: number,
  ) {
    const maxBubbleWidth = width * 0.8;
    const maxBubbleHeight = height * 0.4;
    const padding = 10;
    const lineSpacing = 1.2;

    const groupedTexts = this.groupTextsBySpeaker(texts);

    groupedTexts.forEach((group, index) => {
      const [speaker, lines] = group;
      const text = lines.join(' ');

      let fontSize = 20;
      ctx.font = `${fontSize}px Arial`;

      let bubbleWidth = 0;
      let bubbleHeight = 0;
      let wrappedText: string[] = [];

      do {
        ctx.font = `${fontSize}px Arial`;
        wrappedText = this.wrapText(ctx, text, maxBubbleWidth - padding * 2);
        bubbleWidth = Math.min(
          this.getMaxLineWidth(ctx, wrappedText) + padding * 2,
          maxBubbleWidth,
        );
        bubbleHeight =
          (wrappedText.length + 1) * fontSize * lineSpacing + padding * 2;
        fontSize--;
      } while (
        (bubbleWidth > maxBubbleWidth || bubbleHeight > maxBubbleHeight) &&
        fontSize > 12
      );

      const bubbleX = (width - bubbleWidth) / 2;
      const bubbleY =
        index === 0
          ? padding
          : height -
            bubbleHeight -
            padding -
            (groupedTexts.length - 1 - index) * (bubbleHeight + padding);

      this.drawBubble(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight);

      ctx.fillStyle = 'black';
      ctx.textBaseline = 'top';
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillText(speaker, bubbleX + padding, bubbleY + padding);

      ctx.font = `${fontSize}px Arial`;
      wrappedText.forEach((line, lineIndex) => {
        ctx.fillText(
          line,
          bubbleX + padding,
          bubbleY + padding + fontSize * lineSpacing * (lineIndex + 1),
        );
      });
    });
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);

    return lines;
  }

  private getMaxLineWidth(
    ctx: CanvasRenderingContext2D,
    lines: string[],
  ): number {
    return Math.max(...lines.map((line) => ctx.measureText(line).width));
  }

  private groupTextsBySpeaker(texts: string[]): [string, string[]][] {
    const groups: { [speaker: string]: string[] } = {};

    texts.forEach((text) => {
      const [speaker, ...rest] = text.split(':');
      const content = rest.join(':').trim();

      if (!groups[speaker]) {
        groups[speaker] = [];
      }
      groups[speaker].push(content);
    });

    return Object.entries(groups);
  }

  private drawBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const radius = Math.min(20, width / 4, height / 4);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 10, y + height);
    ctx.lineTo(x + width / 2, y + height + 10);
    ctx.lineTo(x + width / 2 + 10, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
