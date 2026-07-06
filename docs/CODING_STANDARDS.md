# Coding Standards: Valorant AI Content Automation

This document defines the strict code style, validation schemas, error handling patterns, structured logging, and testing guidelines. Every AI coding agent and human developer must maintain these standards for TypeScript (Node.js/React) and Python.

---

## 1. Environment and Schema Validation

Every service must validate its configuration and environment variables at startup. Hard failures are preferred over silent failures with default fallbacks.

### I. TypeScript Validation (using Zod)
Every Node.js application must declare a `config.ts` or `env.ts` file that parses and validates `process.env`.

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DB_PATH: z.string().default('./db/state.db'),
  CAPTURES_DIR: z.string(),
  GEMINI_API_KEY: z.string().min(10, 'Gemini API key is required'),
  YT_PUBLISH_HOUR: z.coerce.number().min(0).max(23).default(10),
});

export const ENV = envSchema.parse(process.env);
```

### II. Python Validation (using `os.environ` fallback)
Every Python script must validate environmental dependencies before performing work.

```python
import os
import sys

def validate_environment():
    required_vars = ["CV_CONFIDENCE_THRESHOLD", "OUTPUT_DIR"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        print(f"CRITICAL ERROR: Missing environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)
```

---

## 2. Structured Logging

To make troubleshooting easy, all stdout/stderr output must use structured JSON logging. This allows the Orchestrator to parse error details and save them to the database.

### I. TypeScript Logging Standard
```typescript
interface LogPayload {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  jobId?: string;
  error?: {
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

export function log(payload: Omit<LogPayload, 'timestamp'>) {
  const completeLog: LogPayload = {
    timestamp: new Date().toISOString(),
    ...payload,
  };
  console.log(JSON.stringify(completeLog));
}
```

### II. Python Logging Standard
```python
import json
from datetime import datetime

def log_structured(level, service, message, job_id=None, metadata=None, error=None):
    log_payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "service": service,
        "message": message,
        "jobId": job_id,
        "metadata": metadata or {},
    }
    if error:
        log_payload["error"] = {
            "message": str(error),
        }
    print(json.dumps(log_payload))
```

---

## 3. Robust Error Handling

- **Never Swallow Errors**: If a database query fails or a file cannot be read, do not use an empty catch block.
- **Fail the Job Gracefully**: When an error occurs in an active job pipeline, caught exceptions must be captured, formatted, and written back to the SQLite `jobs` table `error_log` field, and the status updated to `FAILED`.

### Node.js Child Process Execution Pattern:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function runService(command: string, jobId: string) {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      log({ level: 'warn', service: 'orchestrator', message: `Stderr output from: ${command}`, jobId, metadata: { stderr } });
    }
    return stdout;
  } catch (error: any) {
    log({
      level: 'error',
      service: 'orchestrator',
      message: `Failed execution: ${command}`,
      jobId,
      error: { message: error.message, stack: error.stack }
    });
    // Update DB job status to FAILED and write error log
    await db.run(
      'UPDATE jobs SET status = "FAILED", error_log = ?, updated_at = ? WHERE id = ?',
      [error.message, new Date().toISOString(), jobId]
    );
    throw error;
  }
}
```

---

## 4. Testing Requirements

1. **Unit Testing**:
   - TypeScript: Use **Vitest** for quick unit tests of state transitions and config parsers.
   - Python: Use **PyTest** to validate that template-matching functions accurately detect UI assets in sample frames.
2. **Mocking External APIs**:
   - Never run live Gemini API calls, ElevenLabs TTS audio generation, or YouTube uploads inside unit tests. Use mocks to simulate exact payload contract structures.
3. **Integration Testing**:
   - Provide helper scripts in `/scripts/` to run "dry runs" using short test-video assets, skipping the cloud AI/TTS/YouTube stages by supplying mock local media instead.
