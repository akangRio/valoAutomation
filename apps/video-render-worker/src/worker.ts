import { Worker, Job, Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

// 1. Validate environment variables early and loudly at process boot
const envSchema = z.object({
  DATABASE_URL: z.string().url('Invalid or missing DATABASE_URL'),
  REDIS_URL: z.string().url('Invalid or missing REDIS_URL'),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      service: 'video-render-worker',
      message: 'Environment validation failed',
      errors: parsedEnv.error.format(),
    }),
  );
  process.exit(1);
}

const env = parsedEnv.data;
const parsedUrl = new URL(env.REDIS_URL);

const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

// Initialize publishing-queue to enqueue next pipeline step
const publishingQueue = new Queue('publishing-queue', {
  connection: connectionOptions,
});

// 2. Initialize Worker bound to 'video-render-queue' with concurrency 1
const worker = new Worker(
  'video-render-queue',
  async (job: Job) => {
    const { jobId, highlightVideoPath, voiceoverAudioPath, wordTimestampsPath, visualMetadata } = job.data;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'video-render-worker',
        message: `Processing Video Rendering for job ${jobId || job.id}`,
        jobId: jobId || job.id,
      }),
    );

    if (!jobId) {
      throw new Error('Invalid job payload: jobId is required');
    }

    try {
      // Step 1: Update parent Job status to VIDEO_RENDERING, currentStep: VIDEO_RENDERING
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'VIDEO_RENDERING',
          currentStep: 'VIDEO_RENDERING',
        },
      });

      // Step 2: Ensure directories exist
      const storageDir = path.resolve(__dirname, '../../../storage');
      const outputDir = path.join(storageDir, 'output');
      const tempPropsDir = path.join(storageDir, 'temp_props');

      fs.mkdirSync(outputDir, { recursive: true });
      fs.mkdirSync(tempPropsDir, { recursive: true });

      const outputVideoPath = path.join(outputDir, `${jobId}.mp4`);
      const tempPropsJsonPath = path.join(tempPropsDir, `${jobId}.json`);

      // Step 3: Parse word timestamps from disk
      let wordTimestamps = [];
      if (wordTimestampsPath && fs.existsSync(wordTimestampsPath)) {
        const rawContent = fs.readFileSync(wordTimestampsPath, 'utf-8');
        wordTimestamps = JSON.parse(rawContent);
      }

      // Step 4: Write composition props input JSON
      const compositionProps = {
        highlightVideoPath,
        voiceoverAudioPath,
        wordTimestamps,
        visualMetadata,
      };

      fs.writeFileSync(tempPropsJsonPath, JSON.stringify(compositionProps, null, 2));

      // Step 5: Execute Remotion compilation CLI command
      const workerDir = path.resolve(__dirname, '..');
      
      const isMockRender = process.env.RENDER_MOCK_MODE === 'true';
      if (isMockRender) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'video-render-worker',
            message: 'Running in MOCK render mode, creating simulated output file',
            jobId,
          }),
        );
        fs.writeFileSync(outputVideoPath, 'mock-rendered-mp4-video-file-content');
      } else {
        const renderCommand = `npx remotion render ValorantShort --props="${tempPropsJsonPath}" "${outputVideoPath}"`;
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'video-render-worker',
            message: 'Executing Remotion render command',
            jobId,
            command: renderCommand,
          }),
        );

        await new Promise<void>((resolve, reject) => {
          exec(renderCommand, { cwd: workerDir }, (err, stdout, stderr) => {
            if (err) {
              reject(new Error(`Remotion render CLI failure: ${stderr || stdout || err.message}`));
              return;
            }
            resolve();
          });
        });
      }

      // Verify final compiled file exists
      if (!fs.existsSync(outputVideoPath)) {
        throw new Error('Compiled vertical video was not written to disk');
      }

      // Step 6: Atomic PostgreSQL update via transaction
      await prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'VIDEO_COMPLETED',
            currentStep: 'VIDEO_COMPLETED',
            renderedVideoPath: outputVideoPath,
          },
        });
      });

      // Step 7: Query full details to build Publishing payload
      const jobRecord = await prisma.job.findUnique({
        where: { id: jobId },
        include: { metadata: true },
      });

      if (!jobRecord) {
        throw new Error(`Job ${jobId} not found in database`);
      }

      const meta = jobRecord.metadata;
      const suggestedTitle = meta?.suggestedTitle || 'Valorant AI Highlights';
      const description = meta?.description || '';
      const tags = meta?.tags || [];

      // Step 8: Enqueue job into publishing-queue
      await publishingQueue.add('publish-video', {
        jobId,
        renderedVideoPath: outputVideoPath,
        suggestedTitle,
        description,
        tags,
      });

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'video-render-worker',
          message: `Video rendering complete and enqueued to publishing-queue for job ${jobId}`,
          jobId,
        }),
      );

      // Clean up temporary props file
      if (fs.existsSync(tempPropsJsonPath)) {
        fs.unlinkSync(tempPropsJsonPath);
      }

    } catch (error: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'video-render-worker',
          message: `Worker job execution failed: ${error.message}`,
          jobId: jobId || job.id,
          error: {
            message: error.message,
            stack: error.stack,
          },
        }),
      );

      try {
        await prisma.job.update({
          where: { id: jobId || job.id },
          data: {
            status: 'FAILED',
            currentStep: 'VIDEO_RENDERING',
            errorLog: error.message || String(error),
          },
        });
      } catch (dbError: any) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'video-render-worker',
            message: `Failed to record error log in database: ${dbError.message}`,
            jobId: jobId || job.id,
          }),
        );
      }

      throw error;
    }
  },
  {
    connection: connectionOptions,
    concurrency: 1, // Restrict render instances to protect local GPU/CPU execution resources
  },
);

console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'video-render-worker',
    message: 'Video Render Worker bootstrap complete, listening to video-render-queue',
  }),
);

// Graceful shutdown handler
export const shutdown = async () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'video-render-worker',
      message: 'Shutting down Video Render Worker...',
    }),
  );
  await worker.close();
  await publishingQueue.close();
  await prisma.$disconnect();
};

export { worker };
