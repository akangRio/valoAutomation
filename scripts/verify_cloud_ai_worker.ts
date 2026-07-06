import { Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { worker, shutdown } from '../apps/cloud-ai-worker/src/index';
import * as fs from 'fs';
import * as path from 'path';

// Parse Redis connection options
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const parsedUrl = new URL(redisUrl);
const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

async function runCloudAiVerification() {
  console.log('🚀 Starting Cloud AI Worker Task 3.1 integration verification...');

  let testJobId = '';
  let testKeyframesDir = '';
  let cloudAiQueue: Queue | null = null;
  let ttsVoiceQueue: Queue | null = null;

  try {
    // 1. Basic worker structural checks
    if (!worker) {
      throw new Error('Test failed: Worker was not instantiated.');
    }
    const queueName = worker.name;
    console.log(`Worker name (Queue Bound): ${queueName}`);
    if (queueName !== 'cloud-ai-queue') {
      throw new Error(`Test failed: Worker is bound to queue '${queueName}', expected 'cloud-ai-queue'`);
    }

    // 2. Database & Redis connection checks
    const client = await worker.client;
    const pingResult = await (client as any).ping();
    console.log(`Redis connection ping result: ${pingResult}`);
    if (pingResult !== 'PONG') {
      throw new Error(`Test failed: Expected Redis ping 'PONG', got '${pingResult}'`);
    }

    // 3. Create a pending test Job in PostgreSQL database in CV_COMPLETED state
    const testJob = await prisma.job.create({
      data: {
        rawVideoPath: 'mock_unreal_clutch_video.mp4',
        status: 'CV_COMPLETED',
        currentStep: 'CV_COMPLETED',
      },
    });
    testJobId = testJob.id;
    console.log(`Created test job in database: ${testJobId}`);

    // 4. Create dummy keyframes on disk
    const storageDir = path.resolve(__dirname, '../storage');
    testKeyframesDir = path.join(storageDir, 'keyframes', testJobId);
    fs.mkdirSync(testKeyframesDir, { recursive: true });

    // Write 5 mock JPEG files (using tiny blank structures)
    for (let k = 1; k <= 5; k++) {
      const kfPath = path.join(testKeyframesDir, `keyframe_${k}.jpg`);
      fs.writeFileSync(kfPath, 'fake-jpeg-image-content');
    }
    console.log(`✓ Created 5 mock keyframe JPEGs at ${testKeyframesDir}`);

    // 5. Enqueue the job into the cloud-ai-queue
    cloudAiQueue = new Queue('cloud-ai-queue', { connection: connectionOptions });
    await cloudAiQueue.add('cloud-analyze', {
      jobId: testJobId,
      keyframesDir: testKeyframesDir,
      metadata: {
        mapName: 'Bind',
        killsCount: 4,
      },
    });
    console.log(`Enqueued job ${testJobId} into cloud-ai-queue.`);

    // 6. Poll the database for the job status to transition to CLOUD_COMPLETED or FAILED
    console.log('Waiting for worker to process the job via Gemini analyzer (max 15s)...');
    let completedJob: any = null;
    const maxPollSeconds = 15;
    
    for (let i = 0; i < maxPollSeconds; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      
      const job = await prisma.job.findUnique({
        where: { id: testJobId },
        include: { metadata: true },
      });

      if (job) {
        console.log(`[Second ${i + 1}] Job status: ${job.status}, currentStep: ${job.currentStep}`);
        if (job.status === 'CLOUD_COMPLETED' || job.status === 'FAILED') {
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

    // 7. Assert database state modifications
    console.log('Asserting database updates...');
    if (completedJob.currentStep !== 'CLOUD_COMPLETED') {
      throw new Error(`Expected currentStep to be 'CLOUD_COMPLETED', got '${completedJob.currentStep}'`);
    }

    // Check VideoMetadata table relations
    if (!completedJob.metadata) {
      throw new Error('Expected VideoMetadata record to exist, got null');
    }
    const meta = completedJob.metadata;
    console.log('VideoMetadata record found:', meta);
    if (!meta.suggestedTitle.includes('4K') || !meta.suggestedTitle.includes('Bind')) {
      throw new Error(`Title seems incorrect, got '${meta.suggestedTitle}'`);
    }
    if (meta.clutchOverlay !== 'UNREAL 4K DEFENSE') {
      throw new Error(`Expected clutchOverlay to be 'UNREAL 4K DEFENSE', got '${meta.clutchOverlay}'`);
    }
    if (meta.captionColor !== '#00FFFF') {
      throw new Error(`Expected captionColor to be '#00FFFF', got '${meta.captionColor}'`);
    }
    if (!meta.voiceoverScript) {
      throw new Error('Expected voiceoverScript to be populated');
    }

    // 8. Assert job is enqueued in tts-voice-queue matching TTSVoiceJobPayload
    console.log('Asserting enqueued tts-voice-queue job payload...');
    ttsVoiceQueue = new Queue('tts-voice-queue', { connection: connectionOptions });
    const ttsJobs = await ttsVoiceQueue.getJobs(['waiting', 'active']);
    const enqueuedJob = ttsJobs.find((j: any) => j.data.jobId === testJobId);
    
    if (!enqueuedJob) {
      throw new Error(`Test failed: Job ${testJobId} not found in tts-voice-queue`);
    }
    console.log('✓ Found enqueued tts-voice-queue job payload:', enqueuedJob.data);
    if (enqueuedJob.data.scriptText !== meta.voiceoverScript) {
      throw new Error(`Expected scriptText to be '${meta.voiceoverScript}', got '${enqueuedJob.data.scriptText}'`);
    }

    console.log('✅ All integration and state transitions tests passed successfully!');
    console.log('\n🎉 ALL TASK 3.1 CLOUD AI WORKER TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error: any) {
    console.error('\n❌ Cloud AI Worker verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    // 9. Clean up database test records & generated filesystem storage files to keep workspace pristine
    if (testJobId) {
      console.log(`🧼 Cleaning up database records and storage files for test job ${testJobId}...`);
      try {
        if (testKeyframesDir && fs.existsSync(testKeyframesDir)) {
          const files = fs.readdirSync(testKeyframesDir);
          for (const file of files) {
            fs.unlinkSync(path.join(testKeyframesDir, file));
          }
          fs.rmdirSync(testKeyframesDir);
        }

        // Delete database job record (which cascade-deletes metadata record)
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
      if (cloudAiQueue) await cloudAiQueue.queue?.close(); // Clean shutdown of additional local clients
      if (cloudAiQueue) await cloudAiQueue.close();
      if (ttsVoiceQueue) await ttsVoiceQueue.close();
      await shutdown();
      console.log('🔌 All connections shut down cleanly.');
    } catch (shutdownError: any) {
      console.error('⚠️ Error during connection shutdowns:', shutdownError.message);
    }
    process.exit(process.exitCode || 0);
  }
}

// Execute integration checks
runCloudAiVerification();
