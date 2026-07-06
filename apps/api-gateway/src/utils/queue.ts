import { Queue, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const parsedUrl = new URL(redisUrl);

// Connection options parsed from REDIS_URL to avoid TypeScript ioredis version mismatch
export const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

// Independent Redis client connection for direct/metrics queries if needed
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Initialize queues using ConnectionOptions object (which BullMQ accepts natively)
export const cvSlicerQueue = new Queue('cv-slicer-queue', {
  connection: connectionOptions,
});

export const cloudAiQueue = new Queue('cloud-ai-queue', {
  connection: connectionOptions,
});

export const ttsVoiceQueue = new Queue('tts-voice-queue', {
  connection: connectionOptions,
});

export const videoRenderQueue = new Queue('video-render-queue', {
  connection: connectionOptions,
});

export const publishingQueue = new Queue('publishing-queue', {
  connection: connectionOptions,
});

// Helper function to fetch real-time payload stats for a queue
export const getQueueStats = async (queue: Queue) => {
  const [active, completed, failed, delayed, waiting] = await Promise.all([
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getWaitingCount(),
  ]);

  return {
    active,
    completed,
    failed,
    delayed,
    waiting,
  };
};
