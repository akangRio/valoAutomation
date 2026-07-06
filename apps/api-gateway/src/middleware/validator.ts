import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const createJobSchema = z.object({
  rawVideoPath: z.string().min(5, 'Invalid video path length'),
});

export const validateCreateJob = (req: Request, res: Response, next: NextFunction) => {
  const result = createJobSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ status: 'error', errors: result.error.errors });
  }
  req.body = result.data;
  next();
};
