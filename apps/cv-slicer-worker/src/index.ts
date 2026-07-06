import { Worker, Job, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { z } from 'zod';

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

// 2. Initialize worker
const worker = new Worker(
  'cv-slicer-queue',
  async (job: Job) => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'cv-slicer-worker',
        message: `Processing job ${job.id}`,
        jobId: job.id,
      }),
    );

    try {
      const { jobId, rawVideoPath } = job.data;
      if (!jobId || !rawVideoPath) {
        throw new Error('Invalid job payload: jobId and rawVideoPath are required');
      }

      // Placeholder for next task (Task 2.2 OpenCV implementation)
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'cv-slicer-worker',
          message: `CV Slicing placeholder executed successfully for job ${jobId}`,
          jobId,
        }),
      );

      // In Task 2.1, the goal is just to instantiate the worker structure and connect cleanly
    } catch (error: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'cv-slicer-worker',
          message: `Worker job execution failed: ${error.message}`,
          jobId: job.id,
          error: {
            message: error.message,
            stack: error.stack,
          },
        }),
      );
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
  await prisma.$disconnect();
};

export { worker };
