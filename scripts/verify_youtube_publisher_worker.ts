import { Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { worker, shutdown } from '../apps/youtube-publisher-worker/src/index';
import * as fs from 'fs';
import * as path from 'path';

// Force mock mode for integration testing
process.env.YOUTUBE_MOCK_MODE = 'true';

// Parse Redis connection options
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const parsedUrl = new URL(redisUrl);
const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

async function runYouTubePublisherWorkerVerification() {
  console.log('🚀 Starting YouTube Publisher Worker & Disk Housekeeper Task 5.1 & 5.2 integration verification...');

  let mainJobId = '';
  let legacyJobId = '';
  let publishingQueue: Queue | null = null;

  // Track created file paths to safely clean them up
  const filesToCleanup: string[] = [];
  const dirsToCleanup: string[] = [];

  try {
    // 1. Basic worker structural checks
    if (!worker) {
      throw new Error('Test failed: Worker was not instantiated.');
    }
    const queueName = worker.name;
    console.log(`Worker name (Queue Bound): ${queueName}`);
    if (queueName !== 'publishing-queue') {
      throw new Error(`Test failed: Worker is bound to queue '${queueName}', expected 'publishing-queue'`);
    }

    // 2. Database & Redis connection checks
    const client = await worker.client;
    const pingResult = await (client as any).ping();
    console.log(`Redis connection ping result: ${pingResult}`);
    if (pingResult !== 'PONG') {
      throw new Error(`Test failed: Expected Redis ping 'PONG', got '${pingResult}'`);
    }

    // Ensure storage folders exist
    const storageDir = path.resolve(__dirname, '../storage');
    const highlightsDir = path.join(storageDir, 'highlights');
    const outputDir = path.join(storageDir, 'output');
    
    fs.mkdirSync(highlightsDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // --- SEED SECTOR 1: Main Job to Publish (Current Job) ---
    // Create a pending test Job in PostgreSQL in VIDEO_COMPLETED state
    const mainJob = await prisma.job.create({
      data: {
        rawVideoPath: 'raw_main_capture.mp4',
        status: 'VIDEO_COMPLETED',
        currentStep: 'VIDEO_COMPLETED',
        metadata: {
          create: {
            suggestedTitle: 'Insane 5K Clutch Short #Shorts',
            description: 'Crazy 5K clutch gameplay highlight on Bind! #valorant',
            tags: ['valorant', 'clutch', 'gaming'],
            voiceoverScript: 'Unreal skill! Dropping all five enemies in rapid succession!',
            clutchOverlay: 'UNREAL 5K CLUTCH',
            captionColor: '#00FFFF',
          },
        },
      },
    });
    mainJobId = mainJob.id;
    console.log(`Created current test job: ${mainJobId}`);

    // Create main job's mock rendered video file on disk
    const mainRenderedVideoPath = path.join(outputDir, `${mainJobId}.mp4`);
    fs.writeFileSync(mainRenderedVideoPath, 'mock-main-rendered-video-data');
    filesToCleanup.push(mainRenderedVideoPath);

    // Update main job record with its actual renderedVideoPath
    await prisma.job.update({
      where: { id: mainJobId },
      data: { renderedVideoPath: mainRenderedVideoPath },
    });

    // --- SEED SECTOR 2: Legacy Job to Sweep (Older than 5 days) ---
    // We create a legacy COMPLETED job with updatedAt mock-set to 6 days ago.
    // However, Prisma @updatedAt auto-overwrites on save. To bypass this, we will write it,
    // and then we can update the updatedAt field using a raw SQL command, or simply test
    // that the housekeeper handles file sweep candidates. Let's do raw update in PostgreSQL!
    const legacyJob = await prisma.job.create({
      data: {
        rawVideoPath: path.join(storageDir, `legacy_raw_capture_${Date.now()}.mp4`),
        highlightVideoPath: path.join(highlightsDir, `legacy_highlight_${Date.now()}.mp4`),
        renderedVideoPath: path.join(outputDir, `legacy_rendered_${Date.now()}.mp4`),
        keyframesDir: path.join(storageDir, `legacy_keyframes_${Date.now()}`),
        status: 'COMPLETED',
        currentStep: 'COMPLETED',
      },
    });
    legacyJobId = legacyJob.id;

    // Create the physical legacy files on disk so housekeeper can sweep them
    fs.writeFileSync(legacyJob.rawVideoPath, 'legacy-raw-data');
    filesToCleanup.push(legacyJob.rawVideoPath);

    fs.writeFileSync(legacyJob.highlightVideoPath, 'legacy-highlight-data');
    filesToCleanup.push(legacyJob.highlightVideoPath);

    fs.writeFileSync(legacyJob.renderedVideoPath!, 'legacy-rendered-data');
    filesToCleanup.push(legacyJob.renderedVideoPath!);

    fs.mkdirSync(legacyJob.keyframesDir!, { recursive: true });
    dirsToCleanup.push(legacyJob.keyframesDir!);
    const legacyKeyframeFile = path.join(legacyJob.keyframesDir!, 'frame_001.jpg');
    fs.writeFileSync(legacyKeyframeFile, 'legacy-keyframe-data');
    filesToCleanup.push(legacyKeyframeFile);

    console.log(`✓ Successfully seeded legacy files on disk for Job: ${legacyJobId}`);

    // Use Prisma raw execute to force the updatedAt column back to 6 days ago
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    await prisma.$executeRaw`UPDATE "Job" SET "updatedAt" = ${sixDaysAgo} WHERE id = ${legacyJobId}`;
    console.log(`✓ Forced legacy Job ${legacyJobId} updatedAt timestamp to: ${sixDaysAgo.toISOString()}`);

    // --- TEST SECTOR 3: Enqueue Main Job to Publishing Queue ---
    publishingQueue = new Queue('publishing-queue', { connection: connectionOptions });
    await publishingQueue.add('publish-video', {
      jobId: mainJobId,
      renderedVideoPath: mainRenderedVideoPath,
      suggestedTitle: 'Insane 5K Clutch Short #Shorts',
      description: 'Crazy 5K clutch gameplay highlight on Bind! #valorant',
      tags: ['valorant', 'clutch', 'gaming'],
      publishTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours from now
    });
    console.log(`Enqueued job ${mainJobId} into publishing-queue.`);

    // --- TEST SECTOR 4: Polling Status Updates ---
    console.log('Waiting for worker to process publishing queue item (max 15s)...');
    let completedJob: any = null;
    const maxPollSeconds = 15;
    
    for (let i = 0; i < maxPollSeconds; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      
      const job = await prisma.job.findUnique({
        where: { id: mainJobId },
        include: { youtubeUpload: true },
      });

      if (job) {
        console.log(`[Second ${i + 1}] Job status: ${job.status}, currentStep: ${job.currentStep}`);
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          completedJob = job;
          break;
        }
      }
    }

    if (!completedJob) {
      throw new Error(`Test failed: Timed out waiting for job ${mainJobId} to complete`);
    }

    if (completedJob.status === 'FAILED') {
      throw new Error(`Test failed: Job was updated to FAILED with error: ${completedJob.errorLog}`);
    }

    console.log('✓ Main Job successfully transitioned to COMPLETED status.');

    // 3. Assert YouTubeUpload record was created in database
    const uploadRecord = await prisma.youTubeUpload.findUnique({
      where: { jobId: mainJobId },
    });

    if (!uploadRecord) {
      throw new Error('Test failed: YouTubeUpload record was not created in PostgreSQL');
    }
    console.log(`✓ Found YouTubeUpload record in DB. Video ID: ${uploadRecord.youtubeVideoId}, Scheduled For: ${uploadRecord.scheduledFor}`);

    if (!uploadRecord.youtubeVideoId.startsWith('mock_yt_')) {
      throw new Error(`Test failed: Expected mock video ID starting with 'mock_yt_', got '${uploadRecord.youtubeVideoId}'`);
    }

    // Wait a brief moment for the housekeeper to complete its asynchronous files sweep
    console.log('Waiting 2 seconds for Housekeeper async files sweep...');
    await new Promise((r) => setTimeout(r, 2000));

    // 4. Assert that main job files still exist (they should, they are brand new!)
    if (!fs.existsSync(mainRenderedVideoPath)) {
      throw new Error('Test failed: Main rendered video file was incorrectly deleted by housekeeper!');
    }
    console.log('✓ Verified: Current job files are preserved intact.');

    // 5. Assert that legacy job files WERE deleted by the housekeeper
    const legacyRawExists = fs.existsSync(legacyJob.rawVideoPath);
    const legacyHighlightExists = fs.existsSync(legacyJob.highlightVideoPath);
    const legacyRenderedExists = fs.existsSync(legacyJob.renderedVideoPath!);
    const legacyKeyframesDirExists = fs.existsSync(legacyJob.keyframesDir!);

    if (legacyRawExists || legacyHighlightExists || legacyRenderedExists || legacyKeyframesDirExists) {
      throw new Error(`Test failed: Legacy files were NOT successfully swept by housekeeper! Raw exists: ${legacyRawExists}, Highlight: ${legacyHighlightExists}, Rendered: ${legacyRenderedExists}, Keyframes Dir: ${legacyKeyframesDirExists}`);
    }
    console.log('✓ Verified: Legacy job files (>5 days old) were successfully purged by housekeeper.');

    console.log('\n🎉 ALL TASK 5.1 & 5.2 YOUTUBE PUBLISHER AND HOUSEKEEPER TESTS PASSED SUCCESSFULLY! 🎉\n');

  } catch (error: any) {
    console.error(`\n❌ Integration test failed: ${error.message}\n`);
    throw error;
  } finally {
    // Gracefully clean up all seeded test data and close resources
    console.log('Cleaning up test resources...');

    // Close BullMQ Queues and Workers
    if (publishingQueue) {
      await publishingQueue.close();
    }
    await shutdown();

    // Delete created physical files from disk safely
    for (const filepath of filesToCleanup) {
      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath);
        } catch {}
      }
    }

    // Delete folders
    for (const dirpath of dirsToCleanup) {
      if (fs.existsSync(dirpath)) {
        try {
          fs.rmSync(dirpath, { recursive: true, force: true });
        } catch {}
      }
    }

    // Delete database records
    if (mainJobId) {
      try {
        await prisma.job.delete({ where: { id: mainJobId } });
      } catch {}
    }
    if (legacyJobId) {
      try {
        await prisma.job.delete({ where: { id: legacyJobId } });
      } catch {}
    }

    await prisma.$disconnect();
    console.log('Test teardown completed successfully.');
  }
}

// Execute the test script if run via CLI
if (require.main === module) {
  runYouTubePublisherWorkerVerification().catch((err) => {
    console.error('Fatal testing error:', err);
    process.exit(1);
  });
}
