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
  TTS_MOCK_MODE: z.string().default('true'),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      service: 'tts-voice-worker',
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

// Initialize the video-render-queue to enqueue the next pipeline step
const videoRenderQueue = new Queue('video-render-queue', {
  connection: connectionOptions,
});

// Determine if we should run in mock mode
const isMockMode = env.TTS_MOCK_MODE === 'true' || process.env.GEMINI_API_KEY === 'mock_key' || !process.env.GEMINI_API_KEY;

// 2. Initialize worker
const worker = new Worker(
  'tts-voice-queue',
  async (job: Job) => {
    const { jobId, scriptText } = job.data;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'tts-voice-worker',
        message: `Processing TTS voice synchronization for job ${jobId || job.id}`,
        jobId: jobId || job.id,
      }),
    );

    if (!jobId || !scriptText) {
      throw new Error('Invalid job payload: jobId and scriptText are required');
    }

    try {
      // Step 1: Update parent Job status to TTS_GENERATING, currentStep: TTS_GENERATING
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'TTS_GENERATING',
          currentStep: 'TTS_GENERATING',
        },
      });

      // Step 2: Ensure directories exist on disk
      const storageDir = path.resolve(__dirname, '../../../storage');
      const voiceDir = path.join(storageDir, 'voice');
      const timestampsDir = path.join(storageDir, 'timestamps');

      fs.mkdirSync(voiceDir, { recursive: true });
      fs.mkdirSync(timestampsDir, { recursive: true });

      const voiceoverAudioPath = path.join(voiceDir, `${jobId}.mp3`);
      const timestampsJsonPath = path.join(timestampsDir, `${jobId}.json`);

      // Step 3: Spawn Python tts_generator.py subprocess
      const venvPythonPath = path.resolve(__dirname, '../venv/bin/python');
      // If venv/bin/python does not exist, fallback to global python3 for flexible testing
      const pythonPath = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python3';
      const scriptPath = path.resolve(__dirname, './tts_generator.py');

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'tts-voice-worker',
          message: 'Spawning Python TTS Generator subprocess',
          jobId,
          pythonPath,
          scriptPath,
          isMockMode,
        }),
      );

      const args = [
        scriptPath,
        '--text', scriptText,
        '--audio', voiceoverAudioPath,
        '--json', timestampsJsonPath,
      ];

      if (isMockMode) {
        args.push('--mock');
      }

      const result = await new Promise<{
        status: string;
        audio_path: string;
        json_path: string;
        mocked: boolean;
      }>((resolve, reject) => {
        const pyProcess = spawn(pythonPath, args);

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
            reject(new Error(`Python process exited with code ${code}. Error: ${stderrData || stdoutData}`));
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
              // Ignore non-JSON lines
            }
          }

          if (!parsedResult) {
            reject(new Error(`Failed to parse successful TTS result from Python stdout: ${stdoutData}`));
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
          service: 'tts-voice-worker',
          message: 'Python TTS Generator subprocess completed successfully',
          jobId,
          result,
        }),
      );

      // Verify files actually exist on disk
      if (!fs.existsSync(voiceoverAudioPath) || !fs.existsSync(timestampsJsonPath)) {
        throw new Error('Synthesized audio file or timestamps JSON was not written to disk');
      }

      // Step 4: Write relational record to PostgreSQL and update parent Job state inside Transaction
      await prisma.$transaction(async (tx) => {
        // Create TTSAudioSync record
        await tx.tTSAudioSync.create({
          data: {
            jobId,
            voiceoverAudioPath,
            timestampsJsonPath,
          },
        });

        // Update parent Job status
        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'TTS_COMPLETED',
            currentStep: 'TTS_COMPLETED',
          },
        });
      });

      // Step 5: Query relevant details to build exact VideoRenderJobPayload
      const jobRecord = await prisma.job.findUnique({
        where: { id: jobId },
        include: { metadata: true },
      });

      if (!jobRecord) {
        throw new Error(`Job ${jobId} not found in database`);
      }

      const meta = jobRecord.metadata;
      const highlightVideoPath = jobRecord.highlightVideoPath || '';

      const captionColor = meta?.captionColor || '#00FFFF';
      const clutchMomentDescription = meta?.clutchOverlay || 'VALORANT HIGHLIGHT';

      // Step 6: Enqueue job into video-render-queue
      await videoRenderQueue.add('video-render', {
        jobId,
        highlightVideoPath,
        voiceoverAudioPath,
        wordTimestampsPath: timestampsJsonPath,
        visualMetadata: {
          agent: 'Jett',
          captionColor,
          clutchMomentDescription,
        },
      });

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'tts-voice-worker',
          message: `TTS processing completed and next job enqueued to video-render-queue for jobId ${jobId}`,
          jobId,
        }),
      );

    } catch (error: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'tts-voice-worker',
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
            currentStep: 'TTS_GENERATING',
            errorLog: error.message || String(error),
          },
        });
      } catch (dbError: any) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'tts-voice-worker',
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
    concurrency: 1, // Restrict TTS requests to protect quota limits
  },
);

console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'tts-voice-worker',
    message: 'TTS Voice Worker bootstrap complete, listening to tts-voice-queue',
  }),
);

// Graceful shutdown handler
export const shutdown = async () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'tts-voice-worker',
      message: 'Shutting down TTS Voice Worker...',
    }),
  );
  await worker.close();
  await videoRenderQueue.close();
  await prisma.$disconnect();
};

export { worker };
