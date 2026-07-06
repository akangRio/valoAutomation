import express, { Express } from 'express';
import { Server } from 'http';
import { z } from 'zod';
import { validateCreateJob } from './middleware/validator';
import { createJob, getJobStatus } from './controllers/jobs';
import { errorHandler } from './middleware/error';

// 1. Validate environment variables early and loudly at process boot
const envSchema = z.object({
  PORT: z.string().optional().default('3000'),
  DATABASE_URL: z.string().url('Invalid or missing DATABASE_URL'),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      service: 'api-gateway',
      message: 'Environment validation failed',
      errors: parsedEnv.error.format(),
    }),
  );
  process.exit(1);
}

const env = parsedEnv.data;

const app: Express = express();

// 2. Middleware configurations
app.use(express.json());

// 3. Controller Routes
app.post('/api/v1/jobs', validateCreateJob, createJob);
app.get('/api/v1/jobs/:id', getJobStatus);

// 4. Undefined Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// 5. Centralized Error-Catching Middleware
app.use(errorHandler);

// 6. Bootstrap Server
const port = parseInt(env.PORT, 10);
const server: Server = app.listen(port, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'api-gateway',
      message: `Express API Gateway bootstrap complete on port ${port}`,
    }),
  );
});

export { app, server };
