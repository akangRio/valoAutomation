# Coding Standards & Guidelines: Enterprise Edition

This document details the code styling, error handling patterns, structured logging layouts, and testing criteria required across our TypeScript-based monorepo workspace.

---

## 1. Request Schema & Configuration Validation

All inbound data channels (Express HTTP Requests, BullMQ Jobs, and Env files) must validate schemas prior to logic execution.

### I. Express Controller Requests (Zod Validation)

Always declare validation schemas for `req.body` and validate them inside a controller middleware.

```typescript
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
```

---

## 2. Prisma Database Query Standards

- **Use Prisma Client Exclusively**: Avoid raw database queries. Use Prisma's safe, auto-generated query interface.
- **Connection Isolation**: Always import the shared Prisma instance rather than creating new clients in individual modules.

```typescript
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

- **Clean Transaction Patterns**: Use Prisma's interactive transaction APIs (`$transaction`) when modifying multiple relational schemas.

```typescript
const updatedJob = await prisma.$transaction(async (tx) => {
  const job = await tx.job.update({
    where: { id: jobId },
    data: { status: 'CV_COMPLETED' },
  });

  await tx.highlight.create({
    data: { jobId, timestampStart, timestampEnd, killCount },
  });

  return job;
});
```

---

## 3. BullMQ Worker Patterns

Every pipeline worker must follow a consistent, non-blocking asynchronous execution layout:

```typescript
import { Worker, Job } from 'bullmq';
import { prisma } from '@packages/database';
import { log } from '@packages/logger';

const worker = new Worker(
  'cv-slicer-queue',
  async (job: Job) => {
    log({
      level: 'info',
      service: 'cv-slicer',
      message: `Processing job ${job.id}`,
      jobId: job.id,
    });

    try {
      // Execute work logic
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'CV_PARSED' },
      });
    } catch (error: any) {
      log({ level: 'error', service: 'cv-slicer', message: `Worker crash`, error });
      // Bubble error up to allow BullMQ to execute retry policies
      throw error;
    }
  },
  {
    connection: { host: '127.0.0.1', port: 6379 },
    concurrency: 1, // Restrict renderers/parsers to protect local GPU
  },
);
```

---

## 4. Structured JSON Logging

No plain `console.log()` statements. All loggers must output standardized, stringified JSON strings to facilitate orchestrator parsing and log collection tools.

```json
{
  "timestamp": "2026-07-06T09:00:00.000Z",
  "level": "error",
  "service": "video-renderer",
  "message": "FFmpeg thread compiler failed with exit code 1",
  "jobId": "job-12345",
  "error": {
    "message": "FFmpeg process failed",
    "stack": "Error: FFmpeg process failed\n at video-renderer..."
  }
}
```

---

## 5. Testing Requirements

1. **Unit Testing**:
   - Framework: **Vitest** for extreme execution speed and native ESM compatibility.
   - Standard: Create mock instances of Prisma Client and Redis/BullMQ connections when writing unit tests. Never connect to production databases or execute live Gemini API calls in unit tests.
2. **Integration Testing**:
   - Build dry-run verification setups that feed pre-trimmed test videos directly into the Remotion renderer, bypassing live network dependencies (Gemini, ElevenLabs, YouTube) while verifying rendering output correctly.
