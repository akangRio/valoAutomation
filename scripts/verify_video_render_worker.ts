import { Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { worker, shutdown } from '../apps/video-render-worker/src/worker';
import * as fs from 'fs';
import * as path from 'path';

// Force mock mode for integration tests
process.env.RENDER_MOCK_MODE = 'true';

// Parse Redis connection options
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const parsedUrl = new URL(redisUrl);
const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

async function runVideoRenderWorkerVerification() {
  console.log('🚀 Starting Video Render Worker Task 4.3 integration verification...');

  let testJobId = '';
  let videoRenderQueue: Queue | null = null;
  let publishingQueue: Queue | null = null;

  // Track created file paths so we can reliably clean them up on failure or success
  const filesToCleanup: string[] = [];

  try {
    // 1. Basic worker structural checks
    if (!worker) {
      throw new Error('Test failed: Worker was not instantiated.');
    }
    const queueName = worker.name;
    console.log(`Worker name (Queue Bound): ${queueName}`);
    if (queueName !== 'video-render-queue') {
      throw new Error(`Test failed: Worker is bound to queue '${queueName}', expected 'video-render-queue'`);
    }

    // 2. Database & Redis connection checks
    const client = await worker.client;
    const pingResult = await (client as any).ping();
    console.log(`Redis connection ping result: ${pingResult}`);
    if (pingResult !== 'PONG') {
      throw new Error(`Test failed: Expected Redis ping 'PONG', got '${pingResult}'`);
    }

    // 3. Define and create paths for temporary mock assets on disk
    const storageDir = path.resolve(__dirname, '../storage');
    const highlightsDir = path.join(storageDir, 'highlights');
    const voiceDir = path.join(storageDir, 'voice');
    const timestampsDir = path.join(storageDir, 'timestamps');
    const outputDir = path.join(storageDir, 'output');

    // Ensure all directories exist
    fs.mkdirSync(highlightsDir, { recursive: true });
    fs.mkdirSync(voiceDir, { recursive: true });
    fs.mkdirSync(timestampsDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // Generate unique mock paths for this test run
    const mockHighlightVideoPath = path.join(highlightsDir, `test_highlight_render.mp4`);
    const mockVoiceoverAudioPath = path.join(voiceDir, `test_voiceover_render.mp3`);
    const mockWordTimestampsPath = path.join(timestampsDir, `test_timestamps_render.json`);
    const mockRenderedVideoPath = path.join(outputDir, `test_rendered_video.mp4`); // fallback reference

    // Write mock content files
    fs.writeFileSync(mockHighlightVideoPath, 'mock-video-binary-or-stream-content');
    filesToCleanup.push(mockHighlightVideoPath);

    fs.writeFileSync(mockVoiceoverAudioPath, 'mock-audio-binary-or-stream-content');
    filesToCleanup.push(mockVoiceoverAudioPath);

    const mockWordTimestamps = [
      { word: 'HELL', startMs: 0, endMs: 500 },
      { word: 'YES', startMs: 510, endMs: 1200 },
    ];
    fs.writeFileSync(mockWordTimestampsPath, JSON.stringify(mockWordTimestamps, null, 2));
    filesToCleanup.push(mockWordTimestampsPath);

    console.log('✓ Successfully created temporary mock assets on disk.');

    // 4. Create a pending test Job in PostgreSQL in TTS_COMPLETED state
    const testJob = await prisma.job.create({
      data: {
        rawVideoPath: 'raw_test_clip.mp4',
        highlightVideoPath: mockHighlightVideoPath,
        status: 'TTS_COMPLETED',
        currentStep: 'TTS_COMPLETED',
        metadata: {
          create: {
            suggestedTitle: 'AMAZING JET ACE SHORT',
            description: 'Crazy ACE highlight with Jett on Bind!',
            tags: ['valorant', 'jett', 'ace'],
            voiceoverScript: 'I got a crazy ace with Jett on Bind!',
            clutchOverlay: 'UNREAL ACE',
            captionColor: '#FFFF00',
          },
        },
        audioSync: {
          create: {
            voiceoverAudioPath: mockVoiceoverAudioPath,
            timestampsJsonPath: mockWordTimestampsPath,
          },
        },
      },
    });
    testJobId = testJob.id;
    console.log(`Created test job in database: ${testJobId}`);

    // Track output path which is specifically based on the generated jobId
    const actualOutputVideoPath = path.join(outputDir, `${testJobId}.mp4`);
    filesToCleanup.push(actualOutputVideoPath);

    // 5. Enqueue the job into the video-render-queue
    videoRenderQueue = new Queue('video-render-queue', { connection: connectionOptions });
    await videoRenderQueue.add('video-render', {
      jobId: testJobId,
      highlightVideoPath: mockHighlightVideoPath,
      voiceoverAudioPath: mockVoiceoverAudioPath,
      wordTimestampsPath: mockWordTimestampsPath,
      visualMetadata: {
        agent: 'Jett',
        captionColor: '#FFFF00',
        clutchMomentDescription: 'UNREAL ACE',
      },
    });
    console.log(`Enqueued job ${testJobId} into video-render-queue.`);

    // 6. Poll the database for status updates to transition to VIDEO_COMPLETED or FAILED
    console.log('Waiting for worker to process render queue item (max 15s)...');
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
        if (job.status === 'VIDEO_COMPLETED' || job.status === 'FAILED') {
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
    if (completedJob.currentStep !== 'VIDEO_COMPLETED') {
      throw new Error(`Expected currentStep to be 'VIDEO_COMPLETED', got '${completedJob.currentStep}'`);
    }
    if (completedJob.renderedVideoPath !== actualOutputVideoPath) {
      throw new Error(`Expected renderedVideoPath to be '${actualOutputVideoPath}', got '${completedJob.renderedVideoPath}'`);
    }

    // 8. Verify the output file exists
    console.log('Verifying output file on disk...');
    if (!fs.existsSync(actualOutputVideoPath)) {
      throw new Error(`Expected rendered video to exist at ${actualOutputVideoPath}`);
    }
    const outputContent = fs.readFileSync(actualOutputVideoPath, 'utf-8');
    console.log(`✓ Rendered video file content verification: "${outputContent}"`);

    // 9. Assert job was successfully enqueued in publishing-queue
    console.log('Asserting enqueued publishing-queue job payload...');
    publishingQueue = new Queue('publishing-queue', { connection: connectionOptions });
    const publishJobs = await publishingQueue.getJobs(['waiting', 'active']);
    const enqueuedPublishJob = publishJobs.find((j: any) => j.data.jobId === testJobId);
    
    if (!enqueuedPublishJob) {
      throw new Error(`Test failed: Job ${testJobId} not found in publishing-queue`);
    }
    console.log('✓ Found enqueued publishing job:', enqueuedPublishJob.data);
    if (enqueuedPublishJob.data.renderedVideoPath !== actualOutputVideoPath) {
      throw new Error(`Expected renderedVideoPath to be '${actualOutputVideoPath}', got '${enqueuedPublishJob.data.renderedVideoPath}'`);
    }
    if (enqueuedPublishJob.data.suggestedTitle !== 'AMAZING JET ACE SHORT') {
      throw new Error(`Expected suggestedTitle to be 'AMAZING JET ACE SHORT', got '${enqueuedPublishJob.data.suggestedTitle}'`);
    }
    if (enqueuedPublishJob.data.description !== 'Crazy ACE highlight with Jett on Bind!') {
      throw new Error(`Expected description to be 'Crazy ACE highlight with Jett on Bind!', got '${enqueuedPublishJob.data.description}'`);
    }

    console.log('✅ All integration and state transitions tests passed successfully!');
    console.log('\n🎉 ALL TASK 4.3 REMOTION COORDINATION WORKER TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error: any) {
    console.error('\n❌ Video Render Worker verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    // 10. Clean up files
    console.log('🧼 Cleaning up generated filesystem files...');
    for (const file of filesToCleanup) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`✓ Removed file: ${file}`);
        } catch (err: any) {
          console.error(`⚠️ Failed to remove file ${file}: ${err.message}`);
        }
      }
    }

    // 11. Clean up database test records
    if (testJobId) {
      console.log(`🧼 Cleaning up database records for job ${testJobId}...`);
      try {
        await prisma.job.delete({
          where: { id: testJobId },
        });
        console.log('✓ Database records removed successfully.');
      } catch (dbError: any) {
        console.error('⚠️ Database cleanup failed:', dbError.message);
      }
    }

    // 12. Gracefully disconnect connections
    console.log('🔌 Shutting down connections gracefully...');
    try {
      if (videoRenderQueue) await videoRenderQueue.close();
      if (publishingQueue) await publishingQueue.close();
      await shutdown();
      console.log('🔌 All connections shut down cleanly.');
    } catch (shutdownError: any) {
      console.error('⚠️ Error during connection shutdowns:', shutdownError.message);
    }

    process.exit(process.exitCode || 0);
  }
}

// Run the script
runVideoRenderWorkerVerification();
