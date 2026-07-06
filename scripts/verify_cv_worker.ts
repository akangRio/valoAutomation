import { Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { worker, shutdown } from '../apps/cv-slicer-worker/src/index';
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

async function runWorkerVerification() {
  console.log('🚀 Starting CV Slicer Worker Task 2.2 integration verification...');

  let testJobId = '';
  let cvSlicerQueue: Queue | null = null;
  let cloudAiQueue: Queue | null = null;

  try {
    // 1. Basic worker structural checks
    if (!worker) {
      throw new Error('Test failed: Worker was not instantiated.');
    }
    const queueName = worker.name;
    console.log(`Worker name (Queue Bound): ${queueName}`);
    if (queueName !== 'cv-slicer-queue') {
      throw new Error(`Test failed: Worker is bound to queue '${queueName}', expected 'cv-slicer-queue'`);
    }

    // 2. Database & Redis connection checks
    const client = await worker.client;
    const pingResult = await (client as any).ping();
    console.log(`Redis connection ping result: ${pingResult}`);
    if (pingResult !== 'PONG') {
      throw new Error(`Test failed: Expected Redis ping 'PONG', got '${pingResult}'`);
    }

    // 3. Create a pending test Job in PostgreSQL database
    const testJob = await prisma.job.create({
      data: {
        rawVideoPath: 'mock_unreal_clutch_video.mp4',
        status: 'PENDING',
        currentStep: 'INIT',
      },
    });
    testJobId = testJob.id;
    console.log(`Created test job in database: ${testJobId}`);

    // 4. Enqueue the job into the cv-slicer-queue
    cvSlicerQueue = new Queue('cv-slicer-queue', { connection: connectionOptions });
    await cvSlicerQueue.add('cv-slice', {
      jobId: testJobId,
      rawVideoPath: testJob.rawVideoPath,
    });
    console.log(`Enqueued job ${testJobId} into cv-slicer-queue.`);

    // 5. Poll the database for the job status to transition to CV_COMPLETED or FAILED
    console.log('Waiting for worker to process the job using Python CV subprocess (max 30s)...');
    let completedJob: any = null;
    const maxPollSeconds = 30;
    
    for (let i = 0; i < maxPollSeconds; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      
      const job = await prisma.job.findUnique({
        where: { id: testJobId },
        include: { highlights: true },
      });

      if (job) {
        console.log(`[Second ${i + 1}] Job status: ${job.status}, currentStep: ${job.currentStep}`);
        if (job.status === 'CV_COMPLETED' || job.status === 'FAILED') {
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

    // 6. Assert database state modifications
    console.log('Asserting database updates...');
    if (completedJob.currentStep !== 'CV_COMPLETED') {
      throw new Error(`Expected currentStep to be 'CV_COMPLETED', got '${completedJob.currentStep}'`);
    }
    if (!completedJob.highlightVideoPath) {
      throw new Error('Expected highlightVideoPath to be populated, got null');
    }
    if (!completedJob.keyframesDir) {
      throw new Error('Expected keyframesDir to be populated, got null');
    }

    // Check Highlights table relations
    if (completedJob.highlights.length !== 1) {
      throw new Error(`Expected exactly 1 Highlight record, found ${completedJob.highlights.length}`);
    }
    const highlight = completedJob.highlights[0];
    console.log('Highlight record found:', highlight);
    if (highlight.killCount !== 4) {
      throw new Error(`Expected killCount to be 4, got ${highlight.killCount}`);
    }
    if (highlight.confidence !== 0.95) {
      throw new Error(`Expected confidence to be 0.95, got ${highlight.confidence}`);
    }

    // 7. Assert physical file creation on disk
    console.log('Asserting output files exist on disk...');
    if (!fs.existsSync(completedJob.highlightVideoPath)) {
      throw new Error(`Test failed: Highlight video file does not exist at ${completedJob.highlightVideoPath}`);
    }
    console.log(`✓ Highlight video exists at: ${completedJob.highlightVideoPath}`);

    if (!fs.existsSync(completedJob.keyframesDir)) {
      throw new Error(`Test failed: Keyframes directory does not exist at ${completedJob.keyframesDir}`);
    }
    const keyframeFiles = fs.readdirSync(completedJob.keyframesDir);
    console.log(`Keyframes directory files:`, keyframeFiles);
    if (keyframeFiles.length !== 5) {
      throw new Error(`Expected exactly 5 keyframes, found ${keyframeFiles.length}`);
    }
    for (let k = 1; k <= 5; k++) {
      const kfPath = path.join(completedJob.keyframesDir, `keyframe_${k}.jpg`);
      if (!fs.existsSync(kfPath)) {
        throw new Error(`Expected keyframe file to exist at ${kfPath}`);
      }
    }
    console.log('✓ All 5 climax JPEGs successfully verified in keyframes directory.');

    // 8. Assert job is enqueued in cloud-ai-queue matching CloudAIJobPayload
    console.log('Asserting enqueued cloud-ai-queue job payload...');
    cloudAiQueue = new Queue('cloud-ai-queue', { connection: connectionOptions });
    const cloudAiJobs = await cloudAiQueue.getJobs(['waiting', 'active']);
    const enqueuedJob = cloudAiJobs.find((j: any) => j.data.jobId === testJobId);
    
    if (!enqueuedJob) {
      throw new Error(`Test failed: Job ${testJobId} not found in cloud-ai-queue`);
    }
    console.log('✓ Found enqueued cloud-ai-queue job payload:', enqueuedJob.data);
    if (enqueuedJob.data.keyframesDir !== completedJob.keyframesDir) {
      throw new Error(`Expected keyframesDir to be '${completedJob.keyframesDir}', got '${enqueuedJob.data.keyframesDir}'`);
    }
    if (enqueuedJob.data.metadata?.killsCount !== 4) {
      throw new Error(`Expected killsCount in metadata to be 4, got '${enqueuedJob.data.metadata?.killsCount}'`);
    }

    console.log('✅ All integration and state transitions tests passed successfully!');
    console.log('\n🎉 ALL TASK 2.2 OPENCV HIGHLIGHT SLICING TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error: any) {
    console.error('\n❌ CV Slicer Worker verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    // 9. Clean up database test records & generated filesystem storage files to keep workspace pristine
    if (testJobId) {
      console.log(`🧼 Cleaning up database records and storage files for test job ${testJobId}...`);
      try {
        // Find and delete files
        const jobRecord = await prisma.job.findUnique({
          where: { id: testJobId },
        });

        if (jobRecord) {
          if (jobRecord.highlightVideoPath && fs.existsSync(jobRecord.highlightVideoPath)) {
            fs.unlinkSync(jobRecord.highlightVideoPath);
          }
          if (jobRecord.keyframesDir && fs.existsSync(jobRecord.keyframesDir)) {
            const files = fs.readdirSync(jobRecord.keyframesDir);
            for (const file of files) {
              fs.unlinkSync(path.join(jobRecord.keyframesDir, file));
            }
            fs.rmdirSync(jobRecord.keyframesDir);
          }
        }

        // Delete database job record (which cascade-deletes highlight record)
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
      if (cvSlicerQueue) await cvSlicerQueue.close();
      if (cloudAiQueue) await cloudAiQueue.close();
      await shutdown();
      console.log('🔌 All connections shut down cleanly.');
    } catch (shutdownError: any) {
      console.error('⚠️ Error during connection shutdowns:', shutdownError.message);
    }
    process.exit(process.exitCode || 0);
  }
}

// Execute integration checks
runWorkerVerification();
