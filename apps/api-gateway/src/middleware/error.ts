import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  status?: number;
}

export const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;

  const structuredLog = {
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'api-gateway',
    message: err.message || 'Internal Server Error',
    error: {
      message: err.message,
      stack: err.stack,
    },
  };

  // Log in strict JSON format as required by the Coding Standards
  console.error(JSON.stringify(structuredLog));

  res.status(status).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
};
