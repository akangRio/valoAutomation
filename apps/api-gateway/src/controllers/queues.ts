import { Request, Response, NextFunction } from 'express';
import {
  cvSlicerQueue,
  cloudAiQueue,
  ttsVoiceQueue,
  videoRenderQueue,
  publishingQueue,
  getQueueStats,
} from '../utils/queue';

export const getQueuesStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [
      cvSlicer,
      cloudAi,
      ttsVoice,
      videoRender,
      publishing,
    ] = await Promise.all([
      getQueueStats(cvSlicerQueue),
      getQueueStats(cloudAiQueue),
      getQueueStats(ttsVoiceQueue),
      getQueueStats(videoRenderQueue),
      getQueueStats(publishingQueue),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        'cv-slicer-queue': cvSlicer,
        'cloud-ai-queue': cloudAi,
        'tts-voice-queue': ttsVoice,
        'video-render-queue': videoRender,
        'publishing-queue': publishing,
      },
    });
  } catch (error) {
    next(error);
  }
};
