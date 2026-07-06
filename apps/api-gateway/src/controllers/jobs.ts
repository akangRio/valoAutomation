import { Request, Response, NextFunction } from 'express';
import { prisma } from '@packages/database';
import { cvSlicerQueue } from '../utils/queue';

export const createJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rawVideoPath } = req.body;

    const job = await prisma.job.create({
      data: {
        rawVideoPath,
        status: 'PENDING',
        currentStep: 'INIT',
      },
    });

    // Enqueue into cv-slicer-queue matching CVSlicerJobPayload schema
    await cvSlicerQueue.add('cv-slice', {
      jobId: job.id,
      rawVideoPath: job.rawVideoPath,
    });

    res.status(202).json({
      status: 'success',
      message: 'Capture registration accepted',
      data: {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        metadata: true,
      },
    });

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job with ID ${id} not found`,
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: job.id,
        status: job.status,
        currentStep: job.currentStep,
        highlightPath: job.highlightVideoPath,
        suggestedTitle: job.metadata?.suggestedTitle || null,
        renderedVideoPath: job.renderedVideoPath,
        errorLog: job.errorLog,
        updatedAt: job.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
