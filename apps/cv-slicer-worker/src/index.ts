import { Worker, Job, Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

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
      service: 'cv-slicer-worker',
      message: 'Environment validation failed',
      errors: parsedEnv.error.format(),
    }),
  );
  process.exit(1);
}

const env = parsedEnv.data;
const parsedUrl = new URL(env.REDIS_URL);

// Connection options parsed from REDIS_URL to avoid TypeScript ioredis version mismatch
const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

// Initialize the cloud-ai-queue to enqueue the next pipeline step
const cloudAiQueue = new Queue('cloud-ai-queue', {
  connection: connectionOptions,
});

// 2. Initialize worker
const worker = new Worker(
  'cv-slicer-queue',
  async (job: Job) => {
    const { jobId, rawVideoPath } = job.data;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'cv-slicer-worker',
        message: `Processing job ${jobId || job.id}`,
        jobId: jobId || job.id,
      }),
    );

    if (!jobId || !rawVideoPath) {
      throw new Error('Invalid job payload: jobId and rawVideoPath are required');
    }

    try {
      // Step 1: Update parent Job status to CV_PARSING, currentStep: CV_SLICING
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'CV_PARSING',
          currentStep: 'CV_SLICING',
        },
      });

      // Step 2: Ensure highlights and keyframes directories exist on disk
      const storageDir = path.resolve(__dirname, '../../../storage');
      const highlightsDir = path.join(storageDir, 'highlights');
      const keyframesDir = path.join(storageDir, 'keyframes', jobId);

      fs.mkdirSync(highlightsDir, { recursive: true });
      fs.mkdirSync(keyframesDir, { recursive: true });

      // Step 3: Spawn Python CV subprocess using virtualenv python
      const pythonPath = path.resolve(__dirname, '../venv/bin/python');
      const scriptPath = path.resolve(__dirname, './cv_slicer.py');

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'cv-slicer-worker',
          message: 'Spawning Python CV Slicer subprocess',
          jobId,
          pythonPath,
          scriptPath,
        }),
      );

      const result = await new Promise<{
        highlightVideoPath: string;
        keyframesDir: string;
        highlightStart: number;
        highlightEnd: number;
        killCount: number;
        confidence: number;
        keyframes: string[];
      }>((resolve, reject) => {
        const pyProcess = spawn(pythonPath, [
          scriptPath,
          '--video', rawVideoPath,
          '--job-id', jobId,
          '--output-dir', highlightsDir,
          '--keyframes-dir', keyframesDir,
        ]);

        let stdoutData = '';
        let stderrData = '';

        pyProcess.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });

        pyProcess.stderr.on('data', (data) => {
          stderrData += data.toString();
        });

        pyProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}. Error: ${stderrData}`));
            return;
          }

          const lines = stdoutData.split('\n');
          let parsedResult: any = null;
          for (const line of lines) {
            try {
              const cleaned = line.trim();
              if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
                const parsed = JSON.parse(cleaned);
                if (parsed.status === 'success') {
                  parsedResult = parsed;
                  break;
                }
              }
            } catch (e) {
              // Ignore non-JSON or malformed lines
            }
          }

          if (!parsedResult) {
            reject(new Error(`Failed to parse successful CV result from Python stdout: ${stdoutData}`));
          } else {
            resolve(parsedResult);
          }
        });

        pyProcess.on('error', (err) => {
          reject(err);
        });
      });

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'cv-slicer-worker',
          message: 'Python CV Slicer subprocess completed successfully',
          jobId,
          result,
        }),
      );

      // Step 4: Write relational records to PostgreSQL DB via Prisma Transaction
      await prisma.$transaction(async (tx) => {
        await tx.highlight.create({
          data: {
            jobId,
            timestampStart: result.highlightStart,
            timestampEnd: result.highlightEnd,
            killCount: result.killCount,
            confidence: result.confidence,
          },
        });

        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'CV_COMPLETED',
            currentStep: 'CV_COMPLETED',
            highlightVideoPath: result.highlightVideoPath,
            keyframesDir: result.keyframesDir,
          },
        });
      });

      // Step 5: Enqueue the next event into cloud-ai-queue matching CloudAIJobPayload
      await cloudAiQueue.add('cloud-analyze', {
        jobId,
        keyframesDir: result.keyframesDir,
        metadata: {
          killsCount: result.killCount,
          mapName: 'Bind',
        },
      });

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'cv-slicer-worker',
          message: `CV Slicing completed and next job enqueued to cloud-ai-queue for jobId ${jobId}`,
          jobId,
        }),
      );

    } catch (error: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'cv-slicer-worker',
          message: `Worker job execution failed: ${error.message}`,
          jobId: jobId || job.id,
          error: {
            message: error.message,
            stack: error.stack,
          },
        }),
      );

      // Save error details back to database Job record for visibility
      try {
        await prisma.job.update({
          where: { id: jobId || job.id },
          data: {
            status: 'FAILED',
            currentStep: 'CV_SLICING',
            errorLog: error.message || String(error),
          },
        });
      } catch (dbError: any) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'cv-slicer-worker',
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
    concurrency: 1, // Restrict parsers to protect local CPU
  },
);

console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'cv-slicer-worker',
    message: 'CV Slicer Worker bootstrap complete, listening to cv-slicer-queue',
  }),
);

// Graceful shutdown handler
export const shutdown = async () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'cv-slicer-worker',
      message: 'Shutting down CV Slicer Worker...',
    }),
  );
  await worker.close();
  await cloudAiQueue.close();
  await prisma.$disconnect();
};

export { worker };
