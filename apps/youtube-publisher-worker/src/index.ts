import { Worker, Job, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

// 1. Validate environment variables early and loudly at process boot
const envSchema = z.object({
  DATABASE_URL: z.string().url('Invalid or missing DATABASE_URL'),
  REDIS_URL: z.string().url('Invalid or missing REDIS_URL'),
  YOUTUBE_CLIENT_ID: z.string().default('mock_client_id'),
  YOUTUBE_CLIENT_SECRET: z.string().default('mock_client_secret'),
  YOUTUBE_REFRESH_TOKEN: z.string().default('mock_refresh_token'),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      service: 'youtube-publisher-worker',
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

// Check if we are running in mock mode for YouTube uploads
const isMockMode =
  env.YOUTUBE_REFRESH_TOKEN === 'mock_refresh_token' ||
  env.YOUTUBE_REFRESH_TOKEN.startsWith('mock') ||
  process.env.YOUTUBE_MOCK_MODE === 'true';

// 2. Local File Housekeeper Routine (Task 5.2)
async function runHousekeeper() {
  const retentionDays = 5;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - retentionDays);

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'youtube-publisher-worker',
      message: `Starting housekeeper sweep routine for completed jobs updated before ${thresholdDate.toISOString()} (${retentionDays} days retention)`,
    }),
  );

  try {
    // Find all COMPLETED jobs older than the retention threshold
    const jobsToSweep = await prisma.job.findMany({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          lte: thresholdDate,
        },
      },
    });

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'youtube-publisher-worker',
        message: `Found ${jobsToSweep.length} candidate jobs to clean up`,
        count: jobsToSweep.length,
      }),
    );

    let sweptCount = 0;
    for (const job of jobsToSweep) {
      const deletedFiles: string[] = [];

      // Sweep original raw capture video
      if (job.rawVideoPath && fs.existsSync(job.rawVideoPath)) {
        try {
          fs.unlinkSync(job.rawVideoPath);
          deletedFiles.push(job.rawVideoPath);
        } catch (err: any) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              service: 'youtube-publisher-worker',
              message: `Failed to delete raw capture file at ${job.rawVideoPath}: ${err.message}`,
              jobId: job.id,
            }),
          );
        }
      }

      // Sweep trimmed highlights video
      if (job.highlightVideoPath && fs.existsSync(job.highlightVideoPath)) {
        try {
          fs.unlinkSync(job.highlightVideoPath);
          deletedFiles.push(job.highlightVideoPath);
        } catch (err: any) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              service: 'youtube-publisher-worker',
              message: `Failed to delete highlight file at ${job.highlightVideoPath}: ${err.message}`,
              jobId: job.id,
            }),
          );
        }
      }

      // Sweep compiled portrait video
      if (job.renderedVideoPath && fs.existsSync(job.renderedVideoPath)) {
        try {
          fs.unlinkSync(job.renderedVideoPath);
          deletedFiles.push(job.renderedVideoPath);
        } catch (err: any) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              service: 'youtube-publisher-worker',
              message: `Failed to delete rendered file at ${job.renderedVideoPath}: ${err.message}`,
              jobId: job.id,
            }),
          );
        }
      }

      // Sweep keyframes directory
      if (job.keyframesDir && fs.existsSync(job.keyframesDir)) {
        try {
          const stats = fs.statSync(job.keyframesDir);
          if (stats.isDirectory()) {
            fs.rmSync(job.keyframesDir, { recursive: true, force: true });
            deletedFiles.push(`${job.keyframesDir} (directory)`);
          }
        } catch (err: any) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              service: 'youtube-publisher-worker',
              message: `Failed to delete keyframes directory at ${job.keyframesDir}: ${err.message}`,
              jobId: job.id,
            }),
          );
        }
      }

      if (deletedFiles.length > 0) {
        sweptCount++;
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'youtube-publisher-worker',
            message: `Housekeeper swept disk storage files for job ${job.id}`,
            jobId: job.id,
            deletedFiles,
          }),
        );
      }
    }

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'youtube-publisher-worker',
        message: `Housekeeper routine complete. Cleaned up storage for ${sweptCount} jobs.`,
        sweptCount,
      }),
    );
  } catch (err: any) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        service: 'youtube-publisher-worker',
        message: `Housekeeper routine encountered an unhandled exception: ${err.message}`,
        error: {
          message: err.message,
          stack: err.stack,
        },
      }),
    );
  }
}

// 3. Initialize Worker bound to 'publishing-queue'
const worker = new Worker(
  'publishing-queue',
  async (job: Job) => {
    const { jobId, renderedVideoPath, suggestedTitle, description, tags, publishTime } = job.data;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'youtube-publisher-worker',
        message: `Processing YouTube Publishing for job ${jobId || job.id}`,
        jobId: jobId || job.id,
      }),
    );

    if (!jobId || !renderedVideoPath) {
      throw new Error('Invalid job payload: jobId and renderedVideoPath are required');
    }

    try {
      // Step 1: Update parent Job status to PUBLISHING, currentStep: PUBLISHING
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'PUBLISHING',
          currentStep: 'PUBLISHING',
        },
      });

      // Step 2: Ensure rendered video file actually exists on disk
      if (!fs.existsSync(renderedVideoPath)) {
        throw new Error(`Rendered video file not found on disk at path: ${renderedVideoPath}`);
      }

      let youtubeVideoId = '';
      const scheduledFor = publishTime ? new Date(publishTime) : new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Step 3: Run upload via either MOCK or LIVE paths
      if (isMockMode) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'youtube-publisher-worker',
            message: 'Running in MOCK publishing mode. Bypassing live YouTube API upload.',
            jobId,
          }),
        );
        youtubeVideoId = `mock_yt_${Math.random().toString(36).substring(2, 11)}`;
      } else {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'youtube-publisher-worker',
            message: 'Initializing live Google OAuth2 client and YouTube Data API...',
            jobId,
          }),
        );

        // Sign in to Google APIs via local rotating OAuth2 refresh tokens
        const oauth2Client = new google.auth.OAuth2(
          env.YOUTUBE_CLIENT_ID,
          env.YOUTUBE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
          refresh_token: env.YOUTUBE_REFRESH_TOKEN,
        });

        const youtube = google.youtube({
          version: 'v3',
          auth: oauth2Client,
        });

        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'youtube-publisher-worker',
            message: 'Uploading chunked MP4 video as vertical YouTube Short...',
            jobId,
            videoPath: renderedVideoPath,
            title: suggestedTitle,
          }),
        );

        // Upload chunked video as a vertical YouTube Short
        const response = await youtube.videos.insert({
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: suggestedTitle,
              description: description,
              tags: tags,
              categoryId: '20', // Gaming
            },
            status: {
              privacyStatus: 'private', // Uploaded as private first to support scheduled releases
              selfDeclaredMadeForKids: false,
              publishAt: scheduledFor.toISOString(), // Schedule release time
            },
          },
          media: {
            mimeType: 'video/mp4',
            body: fs.createReadStream(renderedVideoPath),
          },
        });

        youtubeVideoId = response.data.id || '';
        if (!youtubeVideoId) {
          throw new Error('Successfully completed insert call, but YouTube returned empty video ID');
        }

        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'youtube-publisher-worker',
            message: `Successfully uploaded and scheduled video to YouTube with ID: ${youtubeVideoId}`,
            jobId,
            youtubeVideoId,
            scheduledFor: scheduledFor.toISOString(),
          }),
        );
      }

      // Step 4: Record YouTubeUpload and mark main Job as COMPLETED in a single transaction
      await prisma.$transaction(async (tx) => {
        // Upsert the YouTubeUpload record
        await tx.youTubeUpload.upsert({
          where: { jobId },
          update: {
            youtubeVideoId,
            scheduledFor,
          },
          create: {
            jobId,
            youtubeVideoId,
            scheduledFor,
          },
        });

        // Set status to COMPLETED
        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            currentStep: 'COMPLETED',
          },
        });
      });

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'youtube-publisher-worker',
          message: `Job ${jobId} successfully marked as COMPLETED. Invoking housekeeper.`,
          jobId,
        }),
      );

      // Step 5: Trigger housekeeper cleanup events asynchronously without blocking the queue
      runHousekeeper().catch((hErr) => {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'youtube-publisher-worker',
            message: `Housekeeper execution triggered by job completion failed: ${hErr.message}`,
            jobId,
          }),
        );
      });

    } catch (error: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'youtube-publisher-worker',
          message: `Worker job execution failed: ${error.message}`,
          jobId: jobId || job.id,
          error: {
            message: error.message,
            stack: error.stack,
          },
        }),
      );

      // Save error logs in database Job record
      try {
        await prisma.job.update({
          where: { id: jobId || job.id },
          data: {
            status: 'FAILED',
            currentStep: 'PUBLISHING',
            errorLog: error.message || String(error),
          },
        });
      } catch (dbError: any) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'youtube-publisher-worker',
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
    concurrency: 1, // Rate limit publishing requests to prevent API thrashing/auth locks
  },
);

console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'youtube-publisher-worker',
    message: 'YouTube Publisher Worker bootstrap complete, listening to publishing-queue',
  }),
);

// Graceful shutdown handler
export const shutdown = async () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'youtube-publisher-worker',
      message: 'Shutting down YouTube Publisher Worker...',
    }),
  );
  await worker.close();
  await prisma.$disconnect();
};

export { worker };
