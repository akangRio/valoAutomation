import { Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { worker, shutdown } from '../apps/tts-voice-worker/src/index';
import * as fs from 'fs';
import * as path from 'path';

// Force mock mode for integration tests to avoid hitting real APIs
process.env.TTS_MOCK_MODE = 'true';

// Parse Redis connection options
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const parsedUrl = new URL(redisUrl);
const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

async function runTtsWorkerVerification() {
  console.log('🚀 Starting TTS Voice Worker Task 3.2 integration verification...');

  let testJobId = '';
  let ttsVoiceQueue: Queue | null = null;
  let videoRenderQueue: Queue | null = null;

  try {
    // 1. Basic worker structural checks
    if (!worker) {
      throw new Error('Test failed: Worker was not instantiated.');
    }
    const queueName = worker.name;
    console.log(`Worker name (Queue Bound): ${queueName}`);
    if (queueName !== 'tts-voice-queue') {
      throw new Error(`Test failed: Worker is bound to queue '${queueName}', expected 'tts-voice-queue'`);
    }

    // 2. Database & Redis connection checks
    const client = await worker.client;
    const pingResult = await (client as any).ping();
    console.log(`Redis connection ping result: ${pingResult}`);
    if (pingResult !== 'PONG') {
      throw new Error(`Test failed: Expected Redis ping 'PONG', got '${pingResult}'`);
    }

    // 3. Create a pending test Job in PostgreSQL database in CLOUD_COMPLETED state
    const testJob = await prisma.job.create({
      data: {
        rawVideoPath: 'mock_unreal_clutch_video.mp4',
        highlightVideoPath: '/storage/highlights/mock_unreal_clutch_video_highlight.mp4',
        status: 'CLOUD_COMPLETED',
        currentStep: 'CLOUD_COMPLETED',
        metadata: {
          create: {
            suggestedTitle: 'UNREAL CLUTCH',
            description: 'Check this out!',
            tags: ['valorant', 'clutch'],
            voiceoverScript: 'I got a crazy four-kill clutch defense with Jett on Bind! Check this out!',
            clutchOverlay: 'UNREAL 4K DEFENSE',
            captionColor: '#00FFFF',
          },
        },
      },
    });
    testJobId = testJob.id;
    console.log(`Created test job in database: ${testJobId}`);

    // 4. Enqueue the job into the tts-voice-queue
    ttsVoiceQueue = new Queue('tts-voice-queue', { connection: connectionOptions });
    await ttsVoiceQueue.add('tts-voice', {
      jobId: testJobId,
      scriptText: 'I got a crazy four-kill clutch defense with Jett on Bind! Check this out!',
    });
    console.log(`Enqueued job ${testJobId} into tts-voice-queue.`);

    // 5. Poll the database for the job status to transition to TTS_COMPLETED or FAILED
    console.log('Waiting for worker to process the job and generate TTS audio (max 15s)...');
    let completedJob: any = null;
    const maxPollSeconds = 15;
    
    for (let i = 0; i < maxPollSeconds; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      
      const job = await prisma.job.findUnique({
        where: { id: testJobId },
        include: { audioSync: true },
      });

      if (job) {
        console.log(`[Second ${i + 1}] Job status: ${job.status}, currentStep: ${job.currentStep}`);
        if (job.status === 'TTS_COMPLETED' || job.status === 'FAILED') {
          completedJob = job;
          break;
        }
      }
    }

    if (!completedJob) {
      throw new Error(`Test failed: Job did not complete processing within ${maxPollSeconds}s`);
    }

    if (completedJob.status === 'FAILED') {
      throw new Error(`Test failed: Job failed during processing with error: ${completedJob.errorLog}`);
    }

    // 6. Assert database state modifications and generated filesystem storage files
    console.log('Asserting database updates...');
    if (completedJob.currentStep !== 'TTS_COMPLETED') {
      throw new Error(`Expected currentStep to be 'TTS_COMPLETED', got '${completedJob.currentStep}'`);
    }

    // Check TTSAudioSync table relations
    if (!completedJob.audioSync) {
      throw new Error('Expected TTSAudioSync record to exist, got null');
    }
    const audioSync = completedJob.audioSync;
    console.log('TTSAudioSync record found:', audioSync);

    // Verify files actually exist on disk
    console.log('Verifying files on disk...');
    if (!fs.existsSync(audioSync.voiceoverAudioPath)) {
      throw new Error(`Expected audio file to exist at ${audioSync.voiceoverAudioPath}`);
    }
    if (!fs.existsSync(audioSync.timestampsJsonPath)) {
      throw new Error(`Expected timestamps JSON file to exist at ${audioSync.timestampsJsonPath}`);
    }

    const timestampsContent = fs.readFileSync(audioSync.timestampsJsonPath, 'utf-8');
    const timestamps = JSON.parse(timestampsContent);
    console.log(`✓ Read ${timestamps.length} timestamps from ${audioSync.timestampsJsonPath}`);
    if (!Array.isArray(timestamps) || timestamps.length === 0) {
      throw new Error('Expected timestamps JSON to be a non-empty array');
    }

    const firstWord = timestamps[0];
    if (!firstWord.word || typeof firstWord.startMs !== 'number' || typeof firstWord.endMs !== 'number') {
      throw new Error('Expected timestamps elements to contain word, startMs, and endMs fields');
    }

    // 7. Assert job is enqueued in video-render-queue matching VideoRenderJobPayload
    console.log('Asserting enqueued video-render-queue job payload...');
    videoRenderQueue = new Queue('video-render-queue', { connection: connectionOptions });
    const renderJobs = await videoRenderQueue.getJobs(['waiting', 'active']);
    const enqueuedJob = renderJobs.find((j: any) => j.data.jobId === testJobId);
    
    if (!enqueuedJob) {
      throw new Error(`Test failed: Job ${testJobId} not found in video-render-queue`);
    }
    console.log('✓ Found enqueued video-render-queue job payload:', enqueuedJob.data);
    if (enqueuedJob.data.voiceoverAudioPath !== audioSync.voiceoverAudioPath) {
      throw new Error(`Expected voiceoverAudioPath to be '${audioSync.voiceoverAudioPath}', got '${enqueuedJob.data.voiceoverAudioPath}'`);
    }
    if (enqueuedJob.data.wordTimestampsPath !== audioSync.timestampsJsonPath) {
      throw new Error(`Expected wordTimestampsPath to be '${audioSync.timestampsJsonPath}', got '${enqueuedJob.data.wordTimestampsPath}'`);
    }
    if (enqueuedJob.data.visualMetadata.captionColor !== '#00FFFF') {
      throw new Error(`Expected captionColor to be '#00FFFF', got '${enqueuedJob.data.visualMetadata.captionColor}'`);
    }
    if (enqueuedJob.data.visualMetadata.clutchMomentDescription !== 'UNREAL 4K DEFENSE') {
      throw new Error(`Expected clutchMomentDescription to be 'UNREAL 4K DEFENSE', got '${enqueuedJob.data.visualMetadata.clutchMomentDescription}'`);
    }

    console.log('✅ All integration and state transitions tests passed successfully!');
    console.log('\n🎉 ALL TASK 3.2 TTS VOICE WORKER TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error: any) {
    console.error('\n❌ TTS Voice Worker verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    // 8. Clean up database test records & generated filesystem storage files to keep workspace pristine
    if (testJobId) {
      console.log(`🧼 Cleaning up database records and storage files for test job ${testJobId}...`);
      try {
        const storageDir = path.resolve(__dirname, '../storage');
        const voiceFile = path.join(storageDir, 'voice', `${testJobId}.mp3`);
        const jsonFile = path.join(storageDir, 'timestamps', `${testJobId}.json`);

        if (fs.existsSync(voiceFile)) {
          fs.unlinkSync(voiceFile);
        }
        if (fs.existsSync(jsonFile)) {
          fs.unlinkSync(jsonFile);
        }

        // Delete database job record (which cascade-deletes metadata and TTSAudioSync records)
        await prisma.job.delete({
          where: { id: testJobId },
        });
        console.log('✓ Cleanup completed successfully.');
      } catch (cleanupError: any) {
        console.error('⚠️ Cleanup failed:', cleanupError.message);
      }
    }

    console.log('🔌 Shutting down connections gracefully...');
    try {
      if (ttsVoiceQueue) await ttsVoiceQueue.close();
      if (videoRenderQueue) await videoRenderQueue.close();
      await shutdown();
      console.log('🔌 All connections shut down cleanly.');
    } catch (shutdownError: any) {
      console.error('⚠️ Error during connection shutdowns:', shutdownError.message);
    }
    process.exit(process.exitCode || 0);
  }
}

// Execute integration checks
runTtsWorkerVerification();
